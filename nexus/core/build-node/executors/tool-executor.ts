/**
 * NEXUS Tool Node Executor
 * 
 * Executes registered tools from the tool registry
 * Supports built-in and dynamically registered tools
 */

import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';
import { toolsRegistry } from '../../tools/registry';

export interface ToolHandler {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export class ToolNodeExecutor extends NodeExecutor<'tool'> {
  readonly type = 'tool' as const;
  private customTools: Map<string, ToolHandler> = new Map();

  constructor() {
    super();
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: ToolHandler): void {
    this.customTools.set(tool.name, tool);
  }

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const toolName = node.config.toolName;
    const toolArgs = { ...context.inputs, ...node.config.toolArgs };

    if (!toolName) {
      return this.failure(
        node.id,
        'Tool name not specified in node config',
        Date.now() - startTime,
        context.retryCount
      );
    }

    try {
      // Get tool from registry or custom tools
      const tool = this.getTool(toolName);
      
      if (!tool) {
        return this.failure(
          node.id,
          `Tool '${toolName}' not found. Available tools: ${this.listAvailableTools().join(', ')}`,
          Date.now() - startTime,
          context.retryCount
        );
      }

      // Validate required parameters
      if (tool.parameters) {
        for (const [param, config] of Object.entries(tool.parameters)) {
          if (config.required && !(param in toolArgs)) {
            return this.failure(
              node.id,
              `Missing required parameter: ${param}`,
              Date.now() - startTime,
              context.retryCount
            );
          }
        }
      }

      // Execute tool
      const result = await tool.handler(toolArgs);

      return this.success(
        node.id,
        { result },
        Date.now() - startTime,
        context.retryCount,
        { toolName }
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
    if (!node.config.toolName || typeof node.config.toolName !== 'string') {
      return false;
    }
    
    return this.hasTool(node.config.toolName);
  }

  getSchema(): NodePort[] {
    return [
      { name: 'args', type: 'object', required: false, description: 'Tool arguments' },
      { name: 'result', type: 'any', required: false, description: 'Tool execution result' }
    ];
  }

  /**
   * Get tool by name from registry or custom tools
   */
  private getTool(name: string): ToolHandler | null {
    // Check custom tools first
    if (this.customTools.has(name)) {
      return this.customTools.get(name)!;
    }

    // Check global registry
    const registryTool = toolsRegistry.get(name);
    if (registryTool) {
      return {
        name: registryTool.name,
        description: registryTool.description,
        parameters: Object.fromEntries(
          registryTool.parameters.map(p => [p.name, { 
            type: p.type, 
            description: p.description, 
            required: p.required 
          }])
        ),
        handler: registryTool.handler
      };
    }

    return null;
  }

  /**
   * Check if tool exists
   */
  private hasTool(name: string): boolean {
    return this.customTools.has(name) || toolsRegistry.has(name);
  }

  /**
   * List all available tools
   */
  private listAvailableTools(): string[] {
    const custom = Array.from(this.customTools.keys());
    const registry = Array.from(toolsRegistry.keys());
    return [...custom, ...registry];
  }
}

export default ToolNodeExecutor;
