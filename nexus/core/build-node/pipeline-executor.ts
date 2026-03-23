/**
 * NEXUS Pipeline Executor
 * 
 * Executes build pipelines with dependency resolution,
 * parallel execution, error handling, and recovery
 */

import { EventEmitter } from 'events';
import { 
  BuildPipeline, 
  BuildNode, 
  ExecutionContext, 
  PipelineExecutionResult, 
  NodeExecutionResult,
  ExecutionOptions,
  PipelineEvent,
  PipelineEventType
} from './types';
import { NodeExecutor } from './executor';
import { SkillNodeExecutor } from './executors/skill-executor';
import { ToolNodeExecutor } from './executors/tool-executor';
import { ConditionNodeExecutor } from './executors/condition-executor';
import { CodeNodeExecutor } from './executors/code-executor';
import { HTTPNodeExecutor } from './executors/http-executor';
import { TransformNodeExecutor } from './executors/transform-executor';
import { randomUUID } from 'crypto';

export interface ExecutorConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
  maxParallelism: number;
  enableLogging: boolean;
  enableMetrics: boolean;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  timeout: 60000,
  retries: 2,
  retryDelay: 1000,
  maxParallelism: 10,
  enableLogging: true,
  enableMetrics: true
};

export class PipelineExecutor extends EventEmitter {
  private executors: Map<string, NodeExecutor>;
  private pipelines: Map<string, BuildPipeline> = new Map();
  private config: ExecutorConfig;
  private executionCache: Map<string, NodeExecutionResult> = new Map();

  constructor(config: Partial<ExecutorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize executors
    this.executors = new Map([
      ['skill', new SkillNodeExecutor()],
      ['tool', new ToolNodeExecutor()],
      ['condition', new ConditionNodeExecutor()],
      ['code', new CodeNodeExecutor()],
      ['http', new HTTPNodeExecutor()],
      ['transform', new TransformNodeExecutor()]
    ]);
  }

  /**
   * Register a pipeline for execution
   */
  registerPipeline(pipeline: BuildPipeline): string {
    this.pipelines.set(pipeline.id, pipeline);
    return pipeline.id;
  }

  /**
   * Register a custom executor
   */
  registerExecutor(type: string, executor: NodeExecutor): void {
    this.executors.set(type, executor);
  }

  /**
   * Execute a pipeline by ID
   */
  async execute(
    pipelineId: string, 
    options: ExecutionOptions = {}
  ): Promise<PipelineExecutionResult> {
    const pipeline = this.pipelines.get(pipelineId);
    
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineId}' not found`);
    }

    return this.executePipeline(pipeline, options);
  }

  /**
   * Execute a pipeline directly
   */
  async executePipeline(
    pipeline: BuildPipeline,
    options: ExecutionOptions = {}
  ): Promise<PipelineExecutionResult> {
    const executionId = randomUUID();
    const startTime = Date.now();
    const nodeResults = new Map<string, NodeExecutionResult>();
    const failedNodeIds: string[] = [];
    const skippedNodeIds: string[] = [];

    this.emitEvent('pipeline:started', pipeline.id, executionId, { 
      pipelineName: pipeline.name 
    });

    try {
      // Get execution order (topological sort)
      const executionOrder = this.getExecutionOrder(pipeline.nodes);

      // Execute nodes
      for (const nodeId of executionOrder) {
        // Check if should skip
        if (options.skipNodes?.includes(nodeId)) {
          skippedNodeIds.push(nodeId);
          continue;
        }

        // Check if starting from specific node
        if (options.startFromNode && nodeId !== options.startFromNode) {
          if (!this.hasDependencyExecuted(nodeId, options.startFromNode, pipeline.nodes, nodeResults)) {
            continue;
          }
        }

        const node = pipeline.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        // Check if dependencies completed successfully
        const depsReady = this.checkDependencies(node, nodeResults);
        if (!depsReady) {
          skippedNodeIds.push(nodeId);
          continue;
        }

        // Execute node
        this.emitEvent('node:started', pipeline.id, executionId, { 
          nodeId, 
          nodeName: node.name, 
          nodeType: node.type 
        });

        const result = await this.executeNode(node, pipeline, nodeResults, options, executionId);
        nodeResults.set(nodeId, result);

        if (result.success) {
          this.emitEvent('node:completed', pipeline.id, executionId, { 
            nodeId, 
            executionTime: result.executionTime 
          });
        } else {
          failedNodeIds.push(nodeId);
          this.emitEvent('node:failed', pipeline.id, executionId, { 
            nodeId, 
            error: result.error 
          });

          // Check if should continue on error
          if (!options.continueOnError && !node.config.continueOnError) {
            break;
          }
        }

        // Handle condition node branching
        if (node.type === 'condition' && result.success) {
          const branch = result.outputs.branch as string;
          const nextNodes = result.outputs.nextNodes as string[] || [];
          
          // Add branch-specific nodes to execution order
          for (const nextId of nextNodes) {
            if (!executionOrder.includes(nextId)) {
              executionOrder.push(nextId);
            }
          }
        }
      }

      // Collect final outputs
      const finalOutputs = this.collectFinalOutputs(pipeline, nodeResults);

      const result: PipelineExecutionResult = {
        pipelineId: pipeline.id,
        executionId,
        success: failedNodeIds.length === 0,
        nodeResults,
        finalOutputs,
        totalExecutionTime: Date.now() - startTime,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        failedNodeIds,
        skippedNodeIds
      };

      this.emitEvent('pipeline:completed', pipeline.id, executionId, { 
        success: result.success,
        totalNodes: pipeline.nodes.length,
        failedNodes: failedNodeIds.length 
      });

      return result;

    } catch (error) {
      this.emitEvent('pipeline:failed', pipeline.id, executionId, { 
        error: error instanceof Error ? error.message : String(error) 
      });

      return {
        pipelineId: pipeline.id,
        executionId,
        success: false,
        nodeResults,
        finalOutputs: {},
        totalExecutionTime: Date.now() - startTime,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        failedNodeIds: Array.from(nodeResults.keys()),
        skippedNodeIds
      };
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: BuildNode,
    pipeline: BuildPipeline,
    previousResults: Map<string, NodeExecutionResult>,
    options: ExecutionOptions,
    executionId: string
  ): Promise<NodeExecutionResult> {
    const executor = this.executors.get(node.type);
    
    if (!executor) {
      return this.createFailureResult(
        node.id,
        `No executor for node type '${node.type}'`,
        0,
        0
      );
    }

    const maxRetries = options.retryCount ?? node.config.retries ?? this.config.retries;
    const retryDelay = options.retryDelay ?? node.config.retryDelay ?? this.config.retryDelay;
    const timeout = options.timeout ?? node.config.timeout ?? this.config.timeout;

    // Build context
    const context: ExecutionContext = {
      pipelineId: pipeline.id,
      executionId,
      nodeId: node.id,
      inputs: this.getNodeInputs(node, previousResults, pipeline.connections),
      outputs: {},
      state: {},
      variables: { ...pipeline.variables, ...options.variables },
      parentContext: undefined,
      retryCount: 0,
      startTime: new Date(),
      timeout
    };

    let lastResult: NodeExecutionResult | null = null;

    // Execute with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      context.retryCount = attempt;

      try {
        // Validate node
        const isValid = await executor.validate(node);
        if (!isValid) {
          return this.createFailureResult(
            node.id,
            'Node validation failed',
            0,
            attempt
          );
        }

        // Execute with timeout
        lastResult = await this.executeWithTimeout(
          () => executor.execute(node, context),
          timeout
        );

        if (lastResult.success) {
          return lastResult;
        }

        // Retry on failure
        if (attempt < maxRetries) {
          this.emitEvent('node:retrying', pipeline.id, executionId, { 
            nodeId: node.id, 
            attempt: attempt + 1,
            maxRetries 
          });
          
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }

      } catch (error) {
        lastResult = this.createFailureResult(
          node.id,
          error instanceof Error ? error.message : String(error),
          0,
          attempt,
          error instanceof Error ? error.stack : undefined
        );

        if (attempt < maxRetries) {
          await this.delay(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    return lastResult!;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(
    operation: () => Promise<NodeExecutionResult>,
    timeoutMs: number
  ): Promise<NodeExecutionResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get execution order via topological sort
   */
  private getExecutionOrder(nodes: BuildNode[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error(`Cyclic dependency detected at node ${nodeId}`);
      }

      visiting.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    // Visit all nodes
    for (const node of nodes) {
      visit(node.id);
    }

    return order;
  }

  /**
   * Get inputs for a node from previous results
   */
  private getNodeInputs(
    node: BuildNode,
    previousResults: Map<string, NodeExecutionResult>,
    connections: any[]
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};

    // Get inputs from connections
    for (const conn of connections) {
      if (conn.targetNodeId === node.id) {
        const sourceResult = previousResults.get(conn.sourceNodeId);
        if (sourceResult?.outputs && conn.sourcePort in sourceResult.outputs) {
          inputs[conn.targetPort] = sourceResult.outputs[conn.sourcePort];
        }
      }
    }

    return inputs;
  }

  /**
   * Check if all dependencies have completed successfully
   */
  private checkDependencies(
    node: BuildNode, 
    results: Map<string, NodeExecutionResult>
  ): boolean {
    for (const depId of node.dependencies) {
      const depResult = results.get(depId);
      if (!depResult || !depResult.success) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a node has a dependency that has been executed
   */
  private hasDependencyExecuted(
    nodeId: string,
    targetId: string,
    nodes: BuildNode[],
    results: Map<string, NodeExecutionResult>
  ): boolean {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return false;

    if (nodeId === targetId) return true;
    
    for (const dep of node.dependencies) {
      if (this.hasDependencyExecuted(dep, targetId, nodes, results)) {
        return true;
      }
    }

    return results.has(nodeId);
  }

  /**
   * Collect outputs from terminal nodes
   */
  private collectFinalOutputs(
    pipeline: BuildPipeline,
    results: Map<string, NodeExecutionResult>
  ): Record<string, unknown> {
    // Find terminal nodes (no outgoing connections)
    const terminalNodeIds = new Set(pipeline.nodes.map(n => n.id));
    
    for (const conn of pipeline.connections) {
      terminalNodeIds.delete(conn.sourceNodeId);
    }

    const outputs: Record<string, unknown> = {};
    
    for (const nodeId of terminalNodeIds) {
      const result = results.get(nodeId);
      const node = pipeline.nodes.find(n => n.id === nodeId);
      
      if (result?.success && node) {
        outputs[node.name] = result.outputs;
      }
    }

    return outputs;
  }

  /**
   * Create failure result
   */
  private createFailureResult(
    nodeId: string,
    error: string,
    executionTime: number,
    retryCount: number,
    errorStack?: string
  ): NodeExecutionResult {
    return {
      nodeId,
      success: false,
      outputs: {},
      error,
      errorStack,
      executionTime,
      retryCount
    };
  }

  /**
   * Emit pipeline event
   */
  private emitEvent(
    type: PipelineEventType,
    pipelineId: string,
    executionId: string,
    data: Record<string, unknown>
  ): void {
    const event: PipelineEvent = {
      type,
      pipelineId,
      executionId,
      timestamp: new Date(),
      data
    };
    this.emit(type, event);
    this.emit('pipeline:event', event);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get pipeline by ID
   */
  getPipeline(id: string): BuildPipeline | undefined {
    return this.pipelines.get(id);
  }

  /**
   * List all registered pipelines
   */
  listPipelines(): BuildPipeline[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Clear execution cache
   */
  clearCache(): void {
    this.executionCache.clear();
  }
}

export default PipelineExecutor;
