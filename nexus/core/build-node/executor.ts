/**
 * NEXUS Build Node - Base Executor
 * 
 * Abstract base class for all node executors in the pipeline.
 * Each executor handles a specific node type (skill, tool, condition, etc.)
 */

import { 
  BuildNode, 
  ExecutionContext, 
  NodeExecutionResult, 
  INodeExecutor, 
  NodePort 
} from './types';

/**
 * Abstract base class for node executors
 * All concrete executors must extend this class
 */
export abstract class NodeExecutor<T extends string = string> implements INodeExecutor {
  abstract readonly type: T;

  /**
   * Execute the node with given context
   * Must be implemented by subclasses
   */
  abstract execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult>;

  /**
   * Validate node configuration before execution
   * Must be implemented by subclasses
   */
  abstract validate(node: BuildNode): Promise<boolean>;

  /**
   * Get the input/output schema for this node type
   * Must be implemented by subclasses
   */
  abstract getSchema(): NodePort[];

  /**
   * Create a successful execution result
   */
  protected success(
    nodeId: string, 
    outputs: Record<string, unknown>, 
    executionTime: number,
    retryCount: number = 0,
    metadata?: Record<string, unknown>
  ): NodeExecutionResult {
    return {
      nodeId,
      success: true,
      outputs,
      executionTime,
      retryCount,
      metadata
    };
  }

  /**
   * Create a failed execution result
   */
  protected failure(
    nodeId: string,
    error: string,
    executionTime: number,
    retryCount: number = 0,
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
   * Measure execution time of an async operation
   */
  protected async measureTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; time: number }> {
    const start = Date.now();
    const result = await operation();
    return { result, time: Date.now() - start };
  }
}

export default NodeExecutor;
