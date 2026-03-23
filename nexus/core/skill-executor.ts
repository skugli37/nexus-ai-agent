/**
 * NEXUS Skill Execution Engine
 * Parses and executes skills with full context and tool integration
 * 
 * Features:
 * - Markdown skill parsing
 * - TypeScript skill loading
 * - LLM-based skill execution
 * - Tool integration
 * - Memory context injection
 */

import ZAI from 'z-ai-web-dev-sdk';
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { toolsRegistry } from '../tools/registry';

// ============================================================================
// Types
// ============================================================================

export interface SkillInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: unknown;
  description: string;
}

export interface SkillOutput {
  name: string;
  type: string;
  description: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  prompt: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  tools?: string[];
  preProcess?: string;
  postProcess?: string;
}

export interface SkillContext {
  sessionId: string;
  inputs: Record<string, unknown>;
  memory: Array<{ content: string; relevance: number }>;
  availableTools: string[];
  metadata: Record<string, unknown>;
}

export interface SkillResult {
  success: boolean;
  output: unknown;
  reasoning?: string;
  tokensUsed: number;
  duration: number;
  toolCalls?: Array<{ tool: string; input: unknown; output: unknown }>;
}

export interface ExecutableSkill {
  definition: SkillDefinition;
  filePath: string;
  loadedAt: Date;
  executionCount: number;
  lastExecuted?: Date;
}

// ============================================================================
// Skill Executor Implementation
// ============================================================================

export class SkillExecutor {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private skills: Map<string, ExecutableSkill> = new Map();
  private skillsPath: string;
  private initialized: boolean = false;

  constructor(skillsPath: string = '.nexus/skills') {
    this.skillsPath = skillsPath;
  }

  /**
   * Initialize the skill executor
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.zai = await ZAI.create();
    await this.loadSkills();

    this.initialized = true;
  }

  /**
   * Load all skills from the skills directory
   */
  async loadSkills(): Promise<number> {
    if (!existsSync(this.skillsPath)) {
      mkdirSync(this.skillsPath, { recursive: true });
      return 0;
    }

    const files = readdirSync(this.skillsPath, { recursive: true }) as string[];
    let loaded = 0;

    for (const file of files) {
      if (file.endsWith('.skill.md') || file.endsWith('.skill.ts')) {
        try {
          const skill = await this.loadSkill(join(this.skillsPath, file));
          if (skill) {
            this.skills.set(skill.name, {
              definition: skill,
              filePath: join(this.skillsPath, file),
              loadedAt: new Date(),
              executionCount: 0
            });
            loaded++;
          }
        } catch (error) {
          console.error(`Failed to load skill ${file}:`, error);
        }
      }
    }

    return loaded;
  }

  /**
   * Load a single skill from file
   */
  private async loadSkill(filePath: string): Promise<SkillDefinition | null> {
    const content = readFileSync(filePath, 'utf-8');

    if (filePath.endsWith('.skill.md')) {
      return this.parseMarkdownSkill(content, basename(filePath));
    } else if (filePath.endsWith('.skill.ts')) {
      return this.loadTypeScriptSkill(filePath, content);
    }

    return null;
  }

  /**
   * Parse markdown skill file
   */
  private parseMarkdownSkill(content: string, filename: string): SkillDefinition {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    const frontMatter: Record<string, unknown> = {};
    let body = content;

    if (frontMatterMatch) {
      const fmContent = frontMatterMatch[1];
      body = frontMatterMatch[2];

      for (const line of fmContent.split('\n')) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          let value: unknown = match[2].trim();
          
          // Parse arrays
          if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
          }
          
          frontMatter[key] = value;
        }
      }
    }

    // Parse inputs from markdown sections
    const inputsMatch = body.match(/##\s*Inputs?\s*\n([\s\S]*?)(?=\n##|$)/i);
    const inputs = this.parseInputs(inputsMatch?.[1] || '');

    // Parse outputs from markdown sections
    const outputsMatch = body.match(/##\s*Outputs?\s*\n([\s\S]*?)(?=\n##|$)/i);
    const outputs = this.parseOutputs(outputsMatch?.[1] || '');

    return {
      name: (frontMatter.name as string) || filename.replace('.skill.md', ''),
      description: (frontMatter.description as string) || '',
      version: (frontMatter.version as string) || '1.0.0',
      author: frontMatter.author as string,
      tags: (frontMatter.tags as string[]) || [],
      prompt: body.trim(),
      inputs,
      outputs,
      tools: (frontMatter.tools as string[]) || undefined
    };
  }

  /**
   * Parse inputs section
   */
  private parseInputs(content: string): SkillInput[] {
    const inputs: SkillInput[] = [];
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      // Match: - name: description (type, required)
      const match = line.match(/-\s*(\w+):\s*(.+?)\s*\((\w+)(?:,\s*(required|optional))?\)/);
      if (match) {
        inputs.push({
          name: match[1],
          type: match[3] as SkillInput['type'],
          required: match[4] === 'required',
          description: match[2]
        });
      } else {
        // Simple format: - name: description
        const simpleMatch = line.match(/-\s*(\w+):\s*(.+)/);
        if (simpleMatch) {
          inputs.push({
            name: simpleMatch[1],
            type: 'string',
            required: false,
            description: simpleMatch[2]
          });
        }
      }
    }

    return inputs;
  }

  /**
   * Parse outputs section
   */
  private parseOutputs(content: string): SkillOutput[] {
    const outputs: SkillOutput[] = [];
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const match = line.match(/-\s*(\w+):\s*(.+)/);
      if (match) {
        outputs.push({
          name: match[1],
          type: 'unknown',
          description: match[2]
        });
      }
    }

    return outputs;
  }

  /**
   * Load TypeScript skill file
   */
  private loadTypeScriptSkill(filePath: string, content: string): SkillDefinition | null {
    try {
      // Extract metadata from comments
      const nameMatch = content.match(/@name\s+(.+)/);
      const descMatch = content.match(/@description\s+(.+)/);
      const versionMatch = content.match(/@version\s+(.+)/);

      return {
        name: nameMatch?.[1] || basename(filePath, '.skill.ts'),
        description: descMatch?.[1] || '',
        version: versionMatch?.[1] || '1.0.0',
        tags: [],
        prompt: content,
        inputs: [],
        outputs: []
      };
    } catch {
      return null;
    }
  }

  /**
   * Execute a skill
   */
  async execute(
    skillName: string,
    context: SkillContext
  ): Promise<SkillResult> {
    const executableSkill = this.skills.get(skillName);
    if (!executableSkill) {
      throw new Error(`Skill '${skillName}' not found. Available: ${Array.from(this.skills.keys()).join(', ')}`);
    }

    const startTime = Date.now();
    const toolCalls: Array<{ tool: string; input: unknown; output: unknown }> = [];

    try {
      // Validate required inputs
      for (const input of executableSkill.definition.inputs) {
        if (input.required && !(input.name in context.inputs)) {
          if (input.default !== undefined) {
            context.inputs[input.name] = input.default;
          } else {
            throw new Error(`Missing required input: ${input.name}`);
          }
        }
      }

      // Build execution prompt
      const executionPrompt = this.buildExecutionPrompt(executableSkill.definition, context);

      // Execute via LLM
      const response = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: executableSkill.definition.prompt
          },
          {
            role: 'user',
            content: executionPrompt
          }
        ],
        max_tokens: 4096,
        temperature: 0.7
      });

      let output = response.choices[0]?.message?.content || '';
      let reasoning: string | undefined;

      // Extract reasoning if present
      const reasoningMatch = output.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
      if (reasoningMatch) {
        reasoning = reasoningMatch[1].trim();
        output = output.replace(/<reasoning>[\s\S]*?<\/reasoning>/, '').trim();
      }

      // Try to parse as JSON
      try {
        output = JSON.parse(output);
      } catch {
        // Keep as string if not valid JSON
      }

      // Update skill stats
      executableSkill.executionCount++;
      executableSkill.lastExecuted = new Date();

      const duration = Date.now() - startTime;

      return {
        success: true,
        output,
        reasoning,
        tokensUsed: response.usage?.total_tokens || 0,
        duration,
        toolCalls
      };

    } catch (error) {
      return {
        success: false,
        output: null,
        tokensUsed: 0,
        duration: Date.now() - startTime,
        toolCalls
      };
    }
  }

  /**
   * Build execution prompt with context
   */
  private buildExecutionPrompt(skill: SkillDefinition, context: SkillContext): string {
    const parts: string[] = [];

    // Add inputs
    parts.push('## Inputs');
    parts.push(JSON.stringify(context.inputs, null, 2));

    // Add memory context
    if (context.memory.length > 0) {
      parts.push('\n## Relevant Memories');
      for (const mem of context.memory.slice(0, 5)) {
        parts.push(`- ${mem.content.slice(0, 200)}... (relevance: ${(mem.relevance * 100).toFixed(0)}%)`);
      }
    }

    // Add available tools
    if (skill.tools && skill.tools.length > 0) {
      parts.push('\n## Available Tools');
      parts.push(skill.tools.join(', '));
    }

    // Add expected output format
    if (skill.outputs.length > 0) {
      parts.push('\n## Expected Output');
      const outputFormat: Record<string, string> = {};
      for (const out of skill.outputs) {
        outputFormat[out.name] = out.description;
      }
      parts.push(JSON.stringify(outputFormat, null, 2));
    }

    return parts.join('\n');
  }

  /**
   * List all skills
   */
  listSkills(): ExecutableSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): ExecutableSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * Register a new skill programmatically
   */
  registerSkill(definition: SkillDefinition): void {
    this.skills.set(definition.name, {
      definition,
      filePath: '',
      loadedAt: new Date(),
      executionCount: 0
    });
  }

  /**
   * Create a new skill file
   */
  async createSkill(definition: SkillDefinition): Promise<string> {
    const filePath = join(this.skillsPath, `${this.toFileName(definition.name)}.skill.md`);

    const content = `---
name: "${definition.name}"
description: "${definition.description}"
version: "${definition.version}"
author: "${definition.author || 'NEXUS'}"
tags: [${definition.tags.map(t => `"${t}"`).join(', ')}]
---

# ${definition.name}

${definition.description}

## Purpose

Describe what this skill does and when to use it.

## Instructions

${definition.prompt}

## Inputs

${definition.inputs.map(i => `- ${i.name}: ${i.description} (${i.type}${i.required ? ', required' : ''})`).join('\n') || 'No inputs defined'}

## Outputs

${definition.outputs.map(o => `- ${o.name}: ${o.description}`).join('\n') || 'No outputs defined'}

## Examples

\`\`\`
User: Example input
Skill: Example output
\`\`\`
`;

    writeFileSync(filePath, content);

    // Register the skill
    this.skills.set(definition.name, {
      definition,
      filePath,
      loadedAt: new Date(),
      executionCount: 0
    });

    return filePath;
  }

  /**
   * Delete a skill
   */
  deleteSkill(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;

    if (skill.filePath && existsSync(skill.filePath)) {
      try {
        unlinkSync(skill.filePath);
      } catch {
        // Ignore file deletion errors
      }
    }

    return this.skills.delete(name);
  }

  /**
   * Get skill statistics
   */
  getStats(): {
    totalSkills: number;
    byTag: Record<string, number>;
    totalExecutions: number;
    mostUsed: string | null;
  } {
    const byTag: Record<string, number> = {};
    let totalExecutions = 0;
    let mostUsed: string | null = null;
    let maxExecutions = 0;

    for (const [name, skill] of this.skills) {
      // Count by tag
      for (const tag of skill.definition.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }

      // Count executions
      totalExecutions += skill.executionCount;

      // Track most used
      if (skill.executionCount > maxExecutions) {
        maxExecutions = skill.executionCount;
        mostUsed = name;
      }
    }

    return {
      totalSkills: this.skills.size,
      byTag,
      totalExecutions,
      mostUsed
    };
  }

  /**
   * Reload skills from disk
   */
  async reload(): Promise<number> {
    this.skills.clear();
    return this.loadSkills();
  }

  /**
   * Search skills by query
   */
  searchSkills(query: string): ExecutableSkill[] {
    const queryLower = query.toLowerCase();
    
    return Array.from(this.skills.values()).filter(skill => {
      const def = skill.definition;
      return (
        def.name.toLowerCase().includes(queryLower) ||
        def.description.toLowerCase().includes(queryLower) ||
        def.tags.some(tag => tag.toLowerCase().includes(queryLower))
      );
    });
  }

  // Helper methods
  private toFileName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
}

export default SkillExecutor;
