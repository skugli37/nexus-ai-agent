/**
 * NEXUS Build Node System - Types and Interfaces
 * 
 * Implements a comprehensive pipeline engine similar to OpenClaw's build node architecture.
 * Supports multiple node types, dependency resolution, parallel execution, and error recovery.
 */

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * All supported node types in the build pipeline
 */
export type NodeType = 
  | 'skill'      // Execute a skill from SKILL.md
  | 'tool'       // Execute a registered tool
  | 'condition'  // Conditional branching
  | 'loop'       // Iterate over items
  | 'parallel'   // Execute multiple nodes in parallel
  | 'memory'     // Memory operations (memorize/recall)
  | 'agent'      // Delegate to a subordinate agent
  | 'transform'  // Transform data
  | 'http'       // HTTP request
  | 'code';      // Execute code

/**
 * Node execution status
 */
export type NodeStatus = 
  | 'pending'    // Not yet executed
  | 'running'    // Currently executing
  | 'completed'  // Successfully completed
  | 'failed'     // Execution failed
  | 'skipped'    // Skipped (e.g., condition not met)
  | 'timeout'    // Execution timed out
  | 'retrying';  // Retrying after failure

// ============================================================================
// NODE INTERFACES
// ============================================================================

/**
 * Input/Output port definition
 */
export interface NodePort {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

/**
 * A single build node in the pipeline
 */
export interface BuildNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  config: NodeConfig;
  inputs: NodePort[];
  outputs: NodePort[];
  dependencies: string[];
  status: NodeStatus;
  metadata: NodeMetadata;
  position?: { x: number; y: number }; // For visual editor
}

/**
 * Node configuration - varies by node type
 */
export interface NodeConfig {
  // Skill node
  skillName?: string;
  skillPrompt?: string;
  
  // Tool node
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  
  // Condition node
  condition?: string;
  trueBranch?: string[];
  falseBranch?: string[];
  
  // Loop node
  iteratorVar?: string;
  iterableSource?: string;
  bodyNodes?: string[];
  maxIterations?: number;
  
  // Parallel node
  parallelNodes?: string[];
  maxConcurrency?: number;
  failFast?: boolean;
  
  // Memory node
  memoryAction?: 'memorize' | 'recall' | 'forget' | 'consolidate';
  memoryType?: 'main' | 'fragment' | 'solution';
  
  // Agent node
  agentProfile?: string;
  agentTask?: string;
  delegationMessage?: string;
  
  // Transform node
  transformType?: 'json' | 'yaml' | 'xml' | 'csv' | 'custom';
  transformExpression?: string;
  mapping?: Record<string, string>;
  
  // HTTP node
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  httpUrl?: string;
  httpHeaders?: Record<string, string>;
  httpBody?: unknown;
  httpTimeout?: number;
  
  // Code node
  codeLanguage?: 'javascript' | 'typescript' | 'python';
  codeScript?: string;
  
  // Common
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  continueOnError?: boolean;
  [key: string]: unknown;
}

/**
 * Node metadata
 */
export interface NodeMetadata {
  createdAt: Date;
  updatedAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
  averageExecutionTime?: number;
  lastError?: string;
  tags?: string[];
  author?: string;
  version?: string;
}

// ============================================================================
// CONNECTION INTERFACES
// ============================================================================

/**
 * Connection between node ports
 */
export interface NodeConnection {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  condition?: string; // Conditional connection
}

// ============================================================================
// PIPELINE INTERFACES
// ============================================================================

/**
 * Pipeline trigger configuration
 */
export interface PipelineTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  schedule?: string; // Cron expression
  webhookPath?: string;
  eventType?: string;
  enabled: boolean;
}

/**
 * Complete pipeline definition
 */
export interface BuildPipeline {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: BuildNode[];
  connections: NodeConnection[];
  variables: Record<string, unknown>;
  triggers?: PipelineTrigger[];
  metadata: PipelineMetadata;
}

/**
 * Pipeline metadata
 */
export interface PipelineMetadata {
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  tags?: string[];
  executionCount: number;
  lastExecutedAt?: Date;
  averageExecutionTime?: number;
}

// ============================================================================
// EXECUTION INTERFACES
// ============================================================================

/**
 * Execution context passed through the pipeline
 */
export interface ExecutionContext {
  pipelineId: string;
  executionId: string;
  nodeId: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
  variables: Record<string, unknown>;
  parentContext?: ExecutionContext;
  retryCount: number;
  startTime: Date;
  timeout: number;
}

/**
 * Result of a single node execution
 */
export interface NodeExecutionResult {
  nodeId: string;
  success: boolean;
  outputs: Record<string, unknown>;
  error?: string;
  errorStack?: string;
  executionTime: number;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Result of a complete pipeline execution
 */
export interface PipelineExecutionResult {
  pipelineId: string;
  executionId: string;
  success: boolean;
  nodeResults: Map<string, NodeExecutionResult>;
  finalOutputs: Record<string, unknown>;
  totalExecutionTime: number;
  startedAt: Date;
  completedAt: Date;
  failedNodeIds: string[];
  skippedNodeIds: string[];
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  continueOnError?: boolean;
  dryRun?: boolean;
  debug?: boolean;
  startFromNode?: string; // For partial execution
  skipNodes?: string[];
  variables?: Record<string, unknown>;
}

// ============================================================================
// EXECUTOR INTERFACES
// ============================================================================

/**
 * Base interface for node executors
 */
export interface INodeExecutor {
  type: NodeType;
  execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult>;
  validate(node: BuildNode): Promise<boolean>;
  getSchema(): NodePort[];
}

/**
 * Executor configuration
 */
export interface ExecutorConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
  maxParallelism: number;
  enableLogging: boolean;
  enableMetrics: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base error class for build node errors
 */
export class BuildNodeError extends Error {
  constructor(
    public code: BuildNodeErrorCode,
    message: string,
    public nodeId?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BuildNodeError';
  }
}

/**
 * Error codes for build node operations
 */
export type BuildNodeErrorCode =
  | 'NODE_NOT_FOUND'
  | 'INVALID_NODE_TYPE'
  | 'VALIDATION_FAILED'
  | 'EXECUTION_TIMEOUT'
  | 'EXECUTION_FAILED'
  | 'DEPENDENCY_NOT_MET'
  | 'CYCLIC_DEPENDENCY'
  | 'INVALID_CONFIGURATION'
  | 'MISSING_INPUT'
  | 'OUTPUT_TYPE_MISMATCH'
  | 'TOOL_NOT_FOUND'
  | 'SKILL_NOT_FOUND'
  | 'AGENT_UNAVAILABLE'
  | 'MEMORY_ERROR'
  | 'HTTP_ERROR'
  | 'CODE_EXECUTION_ERROR'
  | 'TRANSFORM_ERROR'
  | 'CONDITION_EVALUATION_ERROR'
  | 'LOOP_ITERATION_ERROR'
  | 'PARALLEL_EXECUTION_ERROR';

/**
 * Cyclic dependency error
 */
export class CyclicDependencyError extends BuildNodeError {
  constructor(public cyclePath: string[]) {
    super(
      'CYCLIC_DEPENDENCY',
      `Cyclic dependency detected: ${cyclePath.join(' -> ')}`,
      undefined,
      { cyclePath }
    );
    this.name = 'CyclicDependencyError';
  }
}

/**
 * Node execution timeout error
 */
export class NodeTimeoutError extends BuildNodeError {
  constructor(nodeId: string, timeout: number) {
    super(
      'EXECUTION_TIMEOUT',
      `Node ${nodeId} execution timed out after ${timeout}ms`,
      nodeId,
      { timeout }
    );
    this.name = 'NodeTimeoutError';
  }
}

/**
 * Node validation error
 */
export class NodeValidationError extends BuildNodeError {
  constructor(nodeId: string, errors: string[]) {
    super(
      'VALIDATION_FAILED',
      `Node ${nodeId} validation failed: ${errors.join(', ')}`,
      nodeId,
      { errors }
    );
    this.name = 'NodeValidationError';
  }
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Pipeline event types
 */
export type PipelineEventType =
  | 'pipeline:started'
  | 'pipeline:completed'
  | 'pipeline:failed'
  | 'node:started'
  | 'node:completed'
  | 'node:failed'
  | 'node:skipped'
  | 'node:retrying'
  | 'connection:traversed';

/**
 * Pipeline event
 */
export interface PipelineEvent {
  type: PipelineEventType;
  pipelineId: string;
  executionId: string;
  nodeId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

/**
 * Event handler type
 */
export type PipelineEventHandler = (event: PipelineEvent) => void | Promise<void>;

// ============================================================================
// SERIALIZATION INTERFACES
// ============================================================================

/**
 * Serializable pipeline format for JSON export
 */
export interface SerializablePipeline {
  version: string;
  exportedAt: string;
  pipeline: BuildPipeline;
}

/**
 * BUILD.md front matter
 */
export interface BuildMdFrontMatter {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  triggers?: PipelineTrigger[];
}

/**
 * Parsed BUILD.md section
 */
export interface BuildMdSection {
  type: 'node' | 'connection' | 'variables';
  name: string;
  content: string;
  lineStart: number;
  lineEnd: number;
}
