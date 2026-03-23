/**
 * NEXUS Skill Node Executor
 * 
 * Executes SKILL.md files using LLM
 * Loads skill content, extracts prompt, and executes with context
 */

import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';
import ZAI from 'z-ai-web-dev-sdk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export class SkillNodeExecutor extends NodeExecutor<'skill'> {
  readonly type = 'skill' as const;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private skillsPath: string;
  private initialized: boolean = false;

  constructor(skillsPath: string = '.nexus/skills') {
    super();
    this.skillsPath = skillsPath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.zai = await ZAI.create();
    this.initialized = true;
  }

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const skillName = node.config.skillName;

    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    if (!skillName) {
      return this.failure(
        node.id,
        'Skill name not specified in node config',
        Date.now() - startTime,
        context.retryCount
      );
    }

    try {
      // Load skill file
      const skillPath = join(this.skillsPath, `${skillName}.skill.md`);
      
      if (!existsSync(skillPath)) {
        // Try alternate naming
        const altPath = join(this.skillsPath, `${skillName.toLowerCase().replace(/\s+/g, '-')}.skill.md`);
        if (!existsSync(altPath)) {
          return this.failure(
            node.id,
            `Skill '${skillName}' not found. Searched: ${skillPath}`,
            Date.now() - startTime,
            context.retryCount
          );
        }
      }

      const skillContent = readFileSync(skillPath, 'utf-8');
      const { prompt, frontMatter } = this.parseSkillFile(skillContent);

      // Build execution context
      const systemPrompt = this.buildSystemPrompt(prompt, frontMatter);
      const userMessage = this.buildUserMessage(context);

      // Execute with LLM
      const response = await this.zai!.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: node.config.maxTokens || 4096,
        temperature: node.config.temperature || 0.7
      });

      const output = response.choices[0]?.message?.content || '';

      // Parse output if JSON expected
      let parsedOutput: unknown = output;
      try {
        if (node.config.outputFormat === 'json' || output.trim().startsWith('{')) {
          parsedOutput = JSON.parse(output);
        }
      } catch {
        // Keep as string if not valid JSON
      }

      return this.success(
        node.id,
        { 
          result: parsedOutput,
          rawOutput: output,
          tokensUsed: response.usage?.total_tokens || 0,
          model: response.model
        },
        Date.now() - startTime,
        context.retryCount,
        { skillName, skillPath }
      );

    } catch (error) {
      return this.failure(
        node.id,
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime,
        context.retryCount,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    if (!node.config.skillName || typeof node.config.skillName !== 'string') {
      return false;
    }

    // Check if skill file exists
    const skillPath = join(this.skillsPath, `${node.config.skillName}.skill.md`);
    return existsSync(skillPath);
  }

  getSchema(): NodePort[] {
    return [
      { name: 'inputs', type: 'object', required: false, description: 'Skill input parameters' },
      { name: 'context', type: 'object', required: false, description: 'Execution context' },
      { name: 'result', type: 'any', required: false, description: 'Skill execution result' },
      { name: 'tokensUsed', type: 'number', required: false, description: 'Tokens consumed' }
    ];
  }

  /**
   * Parse SKILL.md file into frontmatter and content
   */
  private parseSkillFile(content: string): { 
    frontMatter: Record<string, unknown>; 
    prompt: string 
  } {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    const frontMatter: Record<string, unknown> = {};
    let prompt = content;

    if (frontMatterMatch) {
      const fmContent = frontMatterMatch[1];
      prompt = frontMatterMatch[2].trim();

      for (const line of fmContent.split('\n')) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          let value: unknown = match[2].trim();
          
          // Parse arrays
          if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
          }
          
          // Parse quoted strings
          if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          
          frontMatter[key] = value;
        }
      }
    }

    return { frontMatter, prompt };
  }

  /**
   * Build system prompt from skill content
   */
  private buildSystemPrompt(prompt: string, frontMatter: Record<string, unknown>): string {
    const parts: string[] = [];

    if (frontMatter.name) {
      parts.push(`# Skill: ${frontMatter.name}`);
    }
    if (frontMatter.description) {
      parts.push(`Description: ${frontMatter.description}`);
    }
    parts.push('');
    parts.push(prompt);

    return parts.join('\n');
  }

  /**
   * Build user message from context
   */
  private buildUserMessage(context: ExecutionContext): string {
    const parts: string[] = [];

    if (Object.keys(context.inputs).length > 0) {
      parts.push('## Inputs');
      parts.push('```json');
      parts.push(JSON.stringify(context.inputs, null, 2));
      parts.push('```');
    }

    if (Object.keys(context.variables).length > 0) {
      parts.push('\n## Variables');
      parts.push('```json');
      parts.push(JSON.stringify(context.variables, null, 2));
      parts.push('```');
    }

    if (context.parentContext) {
      parts.push('\n## Parent Context');
      parts.push(`Pipeline: ${context.parentContext.pipelineId}`);
    }

    return parts.join('\n') || 'Execute this skill.';
  }
}

export default SkillNodeExecutor;
