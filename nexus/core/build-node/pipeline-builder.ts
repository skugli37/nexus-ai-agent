/**
 * NEXUS Pipeline Builder
 * 
 * Fluent API for building execution pipelines
 * Similar to OpenClaw's BUILD.md system
 */

import { 
  BuildNode, 
  BuildPipeline, 
  NodeConnection, 
  NodePort,
  PipelineMetadata, 
  PipelineTrigger,
  NodeConfig,
  NodeType
} from './types';
import { randomUUID } from 'crypto';

export class PipelineBuilder {
  private nodes: Map<string, BuildNode> = new Map();
  private connections: NodeConnection[] = [];
  private variables: Record<string, unknown> = {};
  private triggers: PipelineTrigger[] = [];
  private name: string = 'Untitled Pipeline';
  private description: string = '';
  private version: string = '1.0.0';

  // Track node order for dependencies
  private nodeOrder: string[] = [];

  /**
   * Set pipeline name
   */
  setName(name: string): this {
    this.name = name;
    return this;
  }

  /**
   * Set pipeline description
   */
  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Set pipeline version
   */
  setVersion(version: string): this {
    this.version = version;
    return this;
  }

  /**
   * Add a variable to the pipeline
   */
  setVariable(name: string, value: unknown): this {
    this.variables[name] = value;
    return this;
  }

  /**
   * Add multiple variables
   */
  setVariables(variables: Record<string, unknown>): this {
    this.variables = { ...this.variables, ...variables };
    return this;
  }

  /**
   * Add a trigger to the pipeline
   */
  addTrigger(trigger: PipelineTrigger): this {
    this.triggers.push(trigger);
    return this;
  }

  /**
   * Add a skill execution node
   */
  addSkillNode(
    name: string, 
    skillName: string, 
    options: {
      inputs?: Record<string, unknown>;
      timeout?: number;
      retries?: number;
      maxTokens?: number;
      temperature?: number;
      outputFormat?: 'json' | 'text';
    } = {}
  ): string {
    const id = this.generateId('skill');
    const config: NodeConfig = {
      skillName,
      timeout: options.timeout,
      retries: options.retries,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      outputFormat: options.outputFormat
    };

    const node = this.createNode(id, 'skill', name, config, [
      { name: 'inputs', type: 'object', required: false, description: 'Skill input parameters' }
    ], [
      { name: 'result', type: 'any', required: false, description: 'Skill execution result' },
      { name: 'tokensUsed', type: 'number', required: false, description: 'Tokens consumed' }
    ]);

    if (options.inputs) {
      node.config.toolArgs = options.inputs;
    }

    this.addNode(node);
    return id;
  }

  /**
   * Add a tool execution node
   */
  addToolNode(
    name: string,
    toolName: string,
    toolArgs?: Record<string, unknown>,
    options: { timeout?: number; retries?: number } = {}
  ): string {
    const id = this.generateId('tool');
    const config: NodeConfig = {
      toolName,
      toolArgs,
      timeout: options.timeout,
      retries: options.retries
    };

    const node = this.createNode(id, 'tool', name, config, [
      { name: 'args', type: 'object', required: false, description: 'Tool arguments' }
    ], [
      { name: 'result', type: 'any', required: false, description: 'Tool execution result' }
    ]);

    this.addNode(node);
    return id;
  }

  /**
   * Add a condition node for branching
   */
  addConditionNode(
    name: string,
    condition: string,
    options: {
      trueBranch?: string[];
      falseBranch?: string[];
    } = {}
  ): string {
    const id = this.generateId('condition');
    const config: NodeConfig = {
      condition,
      trueBranch: options.trueBranch || [],
      falseBranch: options.falseBranch || []
    };

    const node = this.createNode(id, 'condition', name, config, [
      { name: 'condition', type: 'string', required: true, description: 'Condition expression' }
    ], [
      { name: 'result', type: 'boolean', required: false, description: 'Evaluation result' },
      { name: 'branch', type: 'string', required: false, description: 'Branch taken' },
      { name: 'nextNodes', type: 'array', required: false, description: 'Next node IDs' }
    ]);

    this.addNode(node);
    return id;
  }

  /**
   * Add a parallel execution node
   */
  addParallelNode(
    name: string,
    parallelNodes: string[],
    options: { maxConcurrency?: number; failFast?: boolean } = {}
  ): string {
    const id = this.generateId('parallel');
    const config: NodeConfig = {
      parallelNodes,
      maxConcurrency: options.maxConcurrency || 5,
      failFast: options.failFast ?? true
    };

    const node = this.createNode(id, 'parallel', name, config, [], [
      { name: 'results', type: 'array', required: false, description: 'Results from all nodes' },
      { name: 'errorCount', type: 'number', required: false, description: 'Number of failed nodes' }
    ]);

    this.addNode(node);
    return id;
  }

  /**
   * Add a code execution node
   */
  addCodeNode(
    name: string,
    codeScript: string,
    options: {
      language?: 'javascript' | 'typescript';
      timeout?: number;
    } = {}
  ): string {
    const id = this.generateId('code');
    const config: NodeConfig = {
      codeScript,
      codeLanguage: options.language || 'javascript',
      timeout: options.timeout
    };

    const node = this.createNode(id, 'code', name, config, [
      { name: 'inputs', type: 'object', required: false, description: 'Code input variables' }
    ], [
      { name: 'result', type: 'any', required: false, description: 'Code execution result' },
      { name: 'logs', type: 'array', required: false, description: 'Console output' }
    ]);

    this.addNode(node);
    return id;
  }

  /**
   * Add an HTTP request node
   */
  addHTTPNode(
    name: string,
    httpUrl: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      headers?: Record<string, string>;
      body?: unknown;
      timeout?: number;
    } = {}
  ): string {
    const id = this.generateId('http');
    const config: NodeConfig = {
      httpUrl,
      httpMethod: options.method || 'GET',
      httpHeaders: options.headers,
      httpBody: options.body,
      httpTimeout: options.timeout
    };

    const node = this.createNode(id, 'http', name, config, [], [
      { name: 'status', type: 'number', required: false, description: 'HTTP status code' },
      { name: 'data', type: 'any', required: false, description: 'Response data' },
      { name: 'headers', type: 'object', required: false, description: 'Response headers' }
    ]);

    this.addNode(node);
    return id;
  }

  /**
   * Add a transform node
   */
  addTransformNode(
    name: string,
    transformType: 'json' | 'yaml' | 'csv' | 'xml' | 'custom',
    options: {
      mapping?: Record<string, string>;
      transformExpression?: string;
    } = {}
  ): string {
    const id = this.generateId('transform');
    const config: NodeConfig = {
      transformType,
      mapping: options.mapping,
      transformExpression: options.transformExpression
    };

    const node = this.createNode(id, 'transform', name, config, [
      { name: 'data', type: 'any', required: true, description: 'Input data to transform' }
    ], [
      { name: 'result', type: 'any', required: false, description: 'Transformed data' }
    ]);

    this.addNode(node);
    return id;
  }

  /**
   * Add a memory operation node
   */
  addMemoryNode(
    name: string,
    action: 'memorize' | 'recall' | 'forget' | 'consolidate',
    options: {
      memoryType?: 'main' | 'fragment' | 'solution';
      query?: string;
      content?: string;
      importance?: number;
    } = {}
  ): string {
    const id = this.generateId('memory');
    const config: NodeConfig = {
      memoryAction: action,
      memoryType: options.memoryType || 'main',
      query: options.query,
      content: options.content,
      importance: options.importance
    };

    const node = this.createNode(id, 'memory', name, config, [], [
      { name: 'result', type: 'any', required: false, description: 'Memory operation result' }
    ]);

    this.addNode(node);
    return id;
  }

  /**
   * Connect two nodes
   */
  connect(
    sourceId: string, 
    sourcePort: string, 
    targetId: string, 
    targetPort: string,
    condition?: string
  ): this {
    this.connections.push({
      id: randomUUID(),
      sourceNodeId: sourceId,
      sourcePort,
      targetNodeId: targetId,
      targetPort,
      condition
    });
    return this;
  }

  /**
   * Connect nodes in sequence
   */
  chain(...nodeIds: string[]): this {
    for (let i = 0; i < nodeIds.length - 1; i++) {
      this.connect(nodeIds[i], 'output', nodeIds[i + 1], 'input');
    }
    return this;
  }

  /**
   * Build the final pipeline
   */
  build(): BuildPipeline {
    const nodeArray = Array.from(this.nodes.values());
    
    // Resolve dependencies from connections
    for (const conn of this.connections) {
      const targetNode = this.nodes.get(conn.targetNodeId);
      if (targetNode && !targetNode.dependencies.includes(conn.sourceNodeId)) {
        targetNode.dependencies.push(conn.sourceNodeId);
      }
    }

    // Validate - check for cycles
    this.detectCycles(nodeArray);

    return {
      id: randomUUID(),
      name: this.name,
      description: this.description,
      version: this.version,
      nodes: nodeArray,
      connections: this.connections,
      variables: this.variables,
      triggers: this.triggers,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0
      }
    };
  }

  /**
   * Build from BUILD.md file
   */
  static fromMarkdown(content: string): PipelineBuilder {
    const builder = new PipelineBuilder();
    
    // Parse frontmatter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontMatterMatch) {
      const fm = frontMatterMatch[1];
      for (const line of fm.split('\n')) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const [, key, value] = match;
          switch (key) {
            case 'name':
              builder.setName(value.trim().replace(/['"]/g, ''));
              break;
            case 'description':
              builder.setDescription(value.trim().replace(/['"]/g, ''));
              break;
            case 'version':
              builder.setVersion(value.trim().replace(/['"]/g, ''));
              break;
          }
        }
      }
    }

    // TODO: Parse node definitions from markdown sections
    // This would parse ## Node: xxx sections and create nodes

    return builder;
  }

  // ===================
  // Private methods
  // ===================

  private generateId(type: string): string {
    return `${type}_${randomUUID().slice(0, 8)}`;
  }

  private createNode(
    id: string,
    type: NodeType,
    name: string,
    config: NodeConfig,
    inputs: NodePort[],
    outputs: NodePort[]
  ): BuildNode {
    return {
      id,
      type,
      name,
      config,
      inputs,
      outputs,
      dependencies: [],
      status: 'pending',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0
      }
    };
  }

  private addNode(node: BuildNode): void {
    this.nodes.set(node.id, node);
    this.nodeOrder.push(node.id);
  }

  private detectCycles(nodes: BuildNode[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (hasCycle(node.id)) {
        throw new Error(`Cyclic dependency detected in pipeline`);
      }
    }
  }
}

export default PipelineBuilder;
