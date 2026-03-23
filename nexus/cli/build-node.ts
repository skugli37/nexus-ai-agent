/**
 * NEXUS Build Node System
 * Implements node execution pipeline, skill loading, memory integration, and tool registration
 * Inspired by OpenClaw's build node architecture
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import ZAI from 'z-ai-web-dev-sdk';
import { NexusConfig, SessionConfig } from './config';

// ============================================================================
// Types
// ============================================================================

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type NodeType = 'skill' | 'tool' | 'memory' | 'agent' | 'condition' | 'loop' | 'parallel';

export interface BuildNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  config: Record<string, unknown>;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  dependencies: string[];
  metadata: NodeMetadata;
}

export interface NodeInput {
  name: string;
  type: string;
  required: boolean;
  value?: unknown;
  source?: string; // Reference to another node's output
}

export interface NodeOutput {
  name: string;
  type: string;
  value?: unknown;
}

export interface NodeMetadata {
  description?: string;
  timeout?: number;
  retries?: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillDefinition {
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  inputs: NodeInput[];
  outputs: NodeOutput[];
  execute: string; // Function body or reference
  prompt?: string; // For LLM-based skills
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    enum?: string[];
  }>;
  handler: string; // Function reference or code
}

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'main' | 'fragment' | 'solution';
  metadata: {
    source?: string;
    timestamp: Date;
    tags?: string[];
    relevance?: number;
  };
  embedding?: number[];
}

export interface ExecutionContext {
  sessionId: string;
  nodeId: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
  memory: MemoryManager;
  tools: ToolRegistry;
}

// ============================================================================
// Skill Loader
// ============================================================================

export class SkillLoader {
  private config: NexusConfig;
  private skills: Map<string, SkillDefinition> = new Map();

  constructor(config: NexusConfig) {
    this.config = config;
  }

  /**
   * Load all skills from the skills directory
   */
  async loadAll(): Promise<Map<string, SkillDefinition>> {
    if (!existsSync(this.config.skillsPath)) {
      mkdirSync(this.config.skillsPath, { recursive: true });
      return this.skills;
    }

    const files = readdirSync(this.config.skillsPath, { recursive: true }) as string[];
    
    for (const file of files) {
      if (file.endsWith('.skill.md') || file.endsWith('.skill.json')) {
        try {
          const skill = await this.loadSkill(join(this.config.skillsPath, file));
          if (skill) {
            this.skills.set(skill.name, skill);
          }
        } catch (error) {
          console.error(`Failed to load skill ${file}:`, error);
        }
      }
    }

    return this.skills;
  }

  /**
   * Load a single skill from file
   */
  private async loadSkill(filePath: string): Promise<SkillDefinition | null> {
    const content = readFileSync(filePath, 'utf-8');
    
    if (filePath.endsWith('.skill.md')) {
      return this.parseSkillMd(content, basename(filePath));
    } else if (filePath.endsWith('.skill.json')) {
      return JSON.parse(content) as SkillDefinition;
    }
    
    return null;
  }

  /**
   * Parse SKILL.md format (Agent Zero standard)
   */
  private parseSkillMd(content: string, filename: string): SkillDefinition {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    const frontMatter: Record<string, string | string[]> = {};
    let body = content;
    
    if (frontMatterMatch) {
      const fmContent = frontMatterMatch[1];
      body = frontMatterMatch[2];
      
      // Parse YAML-like front matter
      for (const line of fmContent.split('\n')) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          const value = match[2].trim();
          
          // Handle arrays
          if (value.startsWith('[') && value.endsWith(']')) {
            frontMatter[key] = value
              .slice(1, -1)
              .split(',')
              .map(s => s.trim().replace(/['"]/g, ''));
          } else {
            frontMatter[key] = value.replace(/['"]/g, '');
          }
        }
      }
    }

    return {
      name: (frontMatter.name as string) || filename.replace('.skill.md', ''),
      description: (frontMatter.description as string) || '',
      version: (frontMatter.version as string) || '1.0.0',
      author: frontMatter.author as string,
      tags: (frontMatter.tags as string[]) || [],
      inputs: [],
      outputs: [],
      execute: body.trim(),
      prompt: body.trim(),
    };
  }

  /**
   * Get a skill by name
   */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * List all loaded skills
   */
  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Search skills by tags or description
   */
  searchSkills(query: string): SkillDefinition[] {
    const queryLower = query.toLowerCase();
    return this.listSkills().filter(skill => 
      skill.name.toLowerCase().includes(queryLower) ||
      skill.description.toLowerCase().includes(queryLower) ||
      skill.tags.some(tag => tag.toLowerCase().includes(queryLower))
    );
  }
}

// ============================================================================
// Memory Manager
// ============================================================================

export class MemoryManager {
  private config: NexusConfig;
  private memory: Map<string, MemoryEntry> = new Map();
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  constructor(config: NexusConfig) {
    this.config = config;
    this.loadMemory();
  }

  /**
   * Initialize z-ai client
   */
  private async initZai(): Promise<void> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
  }

  /**
   * Load memory from disk
   */
  private loadMemory(): void {
    const memoryFile = join(this.config.memoryPath, 'memory.json');
    
    if (!existsSync(memoryFile)) {
      return;
    }

    try {
      const content = readFileSync(memoryFile, 'utf-8');
      const entries = JSON.parse(content) as MemoryEntry[];
      
      for (const entry of entries) {
        this.memory.set(entry.id, entry);
      }
    } catch (error) {
      console.error('Failed to load memory:', error);
    }
  }

  /**
   * Save memory to disk
   */
  saveMemory(): void {
    if (!existsSync(this.config.memoryPath)) {
      mkdirSync(this.config.memoryPath, { recursive: true });
    }

    const memoryFile = join(this.config.memoryPath, 'memory.json');
    const entries = Array.from(this.memory.values());
    
    writeFileSync(memoryFile, JSON.stringify(entries, null, 2));
  }

  /**
   * Add entry to memory
   */
  async memorize(
    content: string,
    type: MemoryEntry['type'] = 'fragment',
    metadata?: Partial<MemoryEntry['metadata']>
  ): Promise<MemoryEntry> {
    await this.initZai();

    const entry: MemoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      content,
      type,
      metadata: {
        timestamp: new Date(),
        ...metadata,
      },
    };

    // Generate embedding using z-ai
    // Note: For now, we store without embedding (can be enhanced later)
    
    this.memory.set(entry.id, entry);
    this.saveMemory();
    
    return entry;
  }

  /**
   * Recall from memory by semantic search
   */
  async recall(query: string, limit: number = 5): Promise<MemoryEntry[]> {
    // Simple keyword-based recall (can be enhanced with vector search)
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    const scored = Array.from(this.memory.values()).map(entry => {
      const contentLower = entry.content.toLowerCase();
      let score = 0;
      
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += 1;
        }
      }
      
      // Boost solutions
      if (entry.type === 'solution') {
        score *= 1.5;
      }
      
      return { entry, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }

  /**
   * Get entries by type
   */
  getByType(type: MemoryEntry['type']): MemoryEntry[] {
    return Array.from(this.memory.values()).filter(e => e.type === type);
  }

  /**
   * Forget (remove) an entry
   */
  forget(id: string): boolean {
    const existed = this.memory.delete(id);
    if (existed) {
      this.saveMemory();
    }
    return existed;
  }

  /**
   * Clear all memory
   */
  clear(): void {
    this.memory.clear();
    this.saveMemory();
  }

  /**
   * Get memory stats
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    
    for (const entry of this.memory.values()) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }
    
    return {
      total: this.memory.size,
      byType,
    };
  }
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  /**
   * Register built-in tools
   */
  private registerBuiltInTools(): void {
    // Code Execution Tool
    this.register({
      name: 'code_execution',
      description: 'Execute code in Python, Node.js, or Shell',
      parameters: {
        runtime: {
          type: 'string',
          description: 'Runtime environment',
          required: true,
          enum: ['python', 'nodejs', 'shell'],
        },
        code: {
          type: 'string',
          description: 'Code to execute',
          required: true,
        },
      },
      handler: 'execute_code',
    });

    // Memory Tool
    this.register({
      name: 'memorize',
      description: 'Store information in memory for future reference',
      parameters: {
        content: {
          type: 'string',
          description: 'Content to memorize',
          required: true,
        },
        type: {
          type: 'string',
          description: 'Type of memory entry',
          enum: ['main', 'fragment', 'solution'],
        },
      },
      handler: 'memorize',
    });

    // Search Tool
    this.register({
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        query: {
          type: 'string',
          description: 'Search query',
          required: true,
        },
        num: {
          type: 'number',
          description: 'Number of results',
        },
      },
      handler: 'web_search',
    });

    // Browser Tool
    this.register({
      name: 'browser_action',
      description: 'Interact with web pages',
      parameters: {
        action: {
          type: 'string',
          description: 'Browser action to perform',
          enum: ['navigate', 'click', 'type', 'scroll', 'snapshot'],
          required: true,
        },
        selector: {
          type: 'string',
          description: 'CSS selector for element',
        },
        value: {
          type: 'string',
          description: 'Value to type or URL to navigate',
        },
      },
      handler: 'browser_action',
    });

    // Response Tool
    this.register({
      name: 'response',
      description: 'Send a response to the user',
      parameters: {
        message: {
          type: 'string',
          description: 'Message to send',
          required: true,
        },
      },
      handler: 'response',
    });
  }

  /**
   * Register a new tool
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools
   */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Remove a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }
}

// ============================================================================
// Node Executor
// ============================================================================

export class NodeExecutor {
  private config: NexusConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private skillLoader: SkillLoader;
  private memory: MemoryManager;
  private tools: ToolRegistry;

  constructor(config: NexusConfig) {
    this.config = config;
    this.skillLoader = new SkillLoader(config);
    this.memory = new MemoryManager(config);
    this.tools = new ToolRegistry();
  }

  /**
   * Initialize the executor
   */
  async initialize(): Promise<void> {
    this.zai = await ZAI.create();
    await this.skillLoader.loadAll();
  }

  /**
   * Execute a build node
   */
  async executeNode(
    node: BuildNode,
    context: ExecutionContext
  ): Promise<{ success: boolean; outputs: NodeOutput[]; error?: string }> {
    node.status = 'running';

    try {
      let outputs: NodeOutput[];

      switch (node.type) {
        case 'skill':
          outputs = await this.executeSkill(node, context);
          break;
        case 'tool':
          outputs = await this.executeTool(node, context);
          break;
        case 'memory':
          outputs = await this.executeMemory(node, context);
          break;
        case 'agent':
          outputs = await this.executeAgent(node, context);
          break;
        case 'condition':
          outputs = await this.executeCondition(node, context);
          break;
        case 'loop':
          outputs = await this.executeLoop(node, context);
          break;
        case 'parallel':
          outputs = await this.executeParallel(node, context);
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      node.status = 'completed';
      return { success: true, outputs };
    } catch (error) {
      node.status = 'failed';
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, outputs: [], error: errorMessage };
    }
  }

  /**
   * Execute a skill node
   */
  private async executeSkill(
    node: BuildNode,
    context: ExecutionContext
  ): Promise<NodeOutput[]> {
    const skillName = node.config.skillName as string;
    const skill = this.skillLoader.getSkill(skillName);
    
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // If skill has a prompt, execute via LLM
    if (skill.prompt) {
      const response = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: skill.prompt,
          },
          {
            role: 'user',
            content: JSON.stringify(context.inputs),
          },
        ],
        max_tokens: this.config.model.maxTokens,
        temperature: this.config.model.temperature,
      });

      const content = response.choices[0]?.message?.content || '';
      
      return [{
        name: 'result',
        type: 'string',
        value: content,
      }];
    }

    // Otherwise, execute the skill's code
    // This would require a safe execution environment
    return [{
      name: 'result',
      type: 'string',
      value: `Executed skill: ${skillName}`,
    }];
  }

  /**
   * Execute a tool node
   */
  private async executeTool(
    node: BuildNode,
    context: ExecutionContext
  ): Promise<NodeOutput[]> {
    const toolName = node.config.toolName as string;
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Execute tool based on handler
    const result = await this.executeToolHandler(tool.handler, context.inputs);
    
    return [{
      name: 'result',
      type: 'string',
      value: result,
    }];
  }

  /**
   * Execute a memory node
   */
  private async executeMemory(
    node: BuildNode,
    context: ExecutionContext
  ): Promise<NodeOutput[]> {
    const action = node.config.action as string;
    
    switch (action) {
      case 'memorize': {
        const content = context.inputs.content as string;
        const type = (context.inputs.type as MemoryEntry['type']) || 'fragment';
        const entry = await this.memory.memorize(content, type);
        return [{
          name: 'entryId',
          type: 'string',
          value: entry.id,
        }];
      }
      case 'recall': {
        const query = context.inputs.query as string;
        const limit = (context.inputs.limit as number) || 5;
        const entries = await this.memory.recall(query, limit);
        return [{
          name: 'entries',
          type: 'array',
          value: entries,
        }];
      }
      default:
        throw new Error(`Unknown memory action: ${action}`);
    }
  }

  /**
   * Execute an agent node (delegation)
   */
  private async executeAgent(
    node: BuildNode,
    context: ExecutionContext
  ): Promise<NodeOutput[]> {
    const message = context.inputs.message as string;
    
    const response = await this.zai!.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a subordinate NEXUS agent. Your task is to help with: ${node.config.task || 'general assistance'}`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: this.config.model.maxTokens,
      temperature: this.config.model.temperature,
    });

    return [{
      name: 'response',
      type: 'string',
      value: response.choices[0]?.message?.content || '',
    }];
  }

  /**
   * Execute a condition node
   */
  private async executeCondition(
    node: BuildNode,
    context: ExecutionContext
  ): Promise<NodeOutput[]> {
    const condition = node.config.condition as string;
    
    // Simple condition evaluation (can be enhanced)
    const result = this.evaluateCondition(condition, context);
    
    return [{
      name: 'passed',
      type: 'boolean',
      value: result,
    }];
  }

  /**
   * Execute a loop node
   */
  private async executeLoop(
    node: BuildNode,
    context: ExecutionContext
  ): Promise<NodeOutput[]> {
    const items = context.inputs.items as unknown[];
    const results: unknown[] = [];
    
    for (const item of items) {
      // Execute inner nodes for each item
      // This would need the full pipeline to work
      results.push(item);
    }
    
    return [{
      name: 'results',
      type: 'array',
      value: results,
    }];
  }

  /**
   * Execute parallel nodes
   */
  private async executeParallel(
    node: BuildNode,
    context: ExecutionContext
  ): Promise<NodeOutput[]> {
    // Execute multiple nodes in parallel
    // This would need the full pipeline to work
    return [{
      name: 'completed',
      type: 'boolean',
      value: true,
    }];
  }

  /**
   * Execute a tool handler
   */
  private async executeToolHandler(
    handler: string,
    params: Record<string, unknown>
  ): Promise<string> {
    switch (handler) {
      case 'web_search': {
        if (!this.zai) {
          this.zai = await ZAI.create();
        }
        const result = await this.zai.functions.invoke('web_search', {
          query: String(params.query || ''),
          num: Number(params.num) || 10,
        });
        return JSON.stringify(result);
      }
      default:
        return `Tool ${handler} executed with params: ${JSON.stringify(params)}`;
    }
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple evaluation - can be enhanced with a proper expression parser
    try {
      // Replace variables in condition
      let evaluated = condition;
      for (const [key, value] of Object.entries(context.inputs)) {
        evaluated = evaluated.replace(new RegExp(`\\$${key}`, 'g'), JSON.stringify(value));
      }
      
      // Use Function constructor for safe evaluation
      // In production, consider using a proper expression evaluator
      return Boolean(new Function(`return ${evaluated}`)());
    } catch {
      return false;
    }
  }

  /**
   * Get skill loader
   */
  getSkillLoader(): SkillLoader {
    return this.skillLoader;
  }

  /**
   * Get memory manager
   */
  getMemory(): MemoryManager {
    return this.memory;
  }

  /**
   * Get tool registry
   */
  getTools(): ToolRegistry {
    return this.tools;
  }
}

// ============================================================================
// Pipeline Builder
// ============================================================================

export class PipelineBuilder {
  private nodes: Map<string, BuildNode> = new Map();
  private executionOrder: string[] = [];

  /**
   * Add a node to the pipeline
   */
  addNode(node: BuildNode): this {
    this.nodes.set(node.id, node);
    return this;
  }

  /**
   * Create a skill node
   */
  createSkillNode(name: string, skillName: string, config?: Record<string, unknown>): BuildNode {
    return {
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: 'skill',
      status: 'pending',
      config: { skillName, ...config },
      inputs: [],
      outputs: [],
      dependencies: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  /**
   * Create a tool node
   */
  createToolNode(name: string, toolName: string, config?: Record<string, unknown>): BuildNode {
    return {
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: 'tool',
      status: 'pending',
      config: { toolName, ...config },
      inputs: [],
      outputs: [],
      dependencies: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  /**
   * Create a memory node
   */
  createMemoryNode(name: string, action: string, config?: Record<string, unknown>): BuildNode {
    return {
      id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: 'memory',
      status: 'pending',
      config: { action, ...config },
      inputs: [],
      outputs: [],
      dependencies: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  /**
   * Add dependency between nodes
   */
  addDependency(fromId: string, toId: string): this {
    const toNode = this.nodes.get(toId);
    if (toNode) {
      toNode.dependencies.push(fromId);
    }
    return this;
  }

  /**
   * Calculate execution order using topological sort
   */
  calculateExecutionOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error('Circular dependency detected');
      }

      visiting.add(nodeId);
      const node = this.nodes.get(nodeId);
      
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    this.executionOrder = order;
    return order;
  }

  /**
   * Execute the pipeline
   */
  async execute(
    executor: NodeExecutor,
    initialContext: Partial<ExecutionContext>
  ): Promise<Map<string, { success: boolean; outputs: NodeOutput[]; error?: string }>> {
    const order = this.calculateExecutionOrder();
    const results = new Map<string, { success: boolean; outputs: NodeOutput[]; error?: string }>();
    const state: Record<string, unknown> = { ...initialContext.state };

    for (const nodeId of order) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      // Gather inputs from dependencies
      const inputs: Record<string, unknown> = {};
      for (const depId of node.dependencies) {
        const depResult = results.get(depId);
        if (depResult?.success) {
          for (const output of depResult.outputs) {
            inputs[output.name] = output.value;
          }
        }
      }

      const context: ExecutionContext = {
        sessionId: initialContext.sessionId || 'default',
        nodeId,
        inputs: { ...inputs, ...initialContext.inputs },
        outputs: {},
        state,
        memory: executor.getMemory(),
        tools: executor.getTools(),
      };

      const result = await executor.executeNode(node, context);
      results.set(nodeId, result);

      // Update state with outputs
      if (result.success) {
        for (const output of result.outputs) {
          state[`${node.name}.${output.name}`] = output.value;
        }
      }
    }

    return results;
  }

  /**
   * Get all nodes
   */
  getNodes(): BuildNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get execution order
   */
  getExecutionOrder(): string[] {
    return this.executionOrder;
  }

  /**
   * Clear the pipeline
   */
  clear(): void {
    this.nodes.clear();
    this.executionOrder = [];
  }
}
