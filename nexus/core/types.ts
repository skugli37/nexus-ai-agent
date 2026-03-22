/**
 * NEXUS Core Engine - Shared Types and Interfaces
 * 
 * This module defines all shared types, interfaces, and event definitions
 * used across the NEXUS Core Engine components.
 */

import { EventEmitter } from 'events';

// ============================================================================
// AGENT STATE TYPES
// ============================================================================

export type AgentStatus = 
  | 'idle'           // Agent is idle, waiting for input
  | 'processing'     // Agent is actively processing a task
  | 'dreaming'       // Agent is in dream cycle (background processing)
  | 'reflecting'     // Agent is self-reflecting
  | 'learning'       // Agent is learning from experience
  | 'error';         // Agent encountered an error

export type AgentPhase = 
  | 'conscious'      // Active interaction phase
  | 'subconscious';  // Background processing phase

export interface AgentState {
  id: string;
  status: AgentStatus;
  phase: AgentPhase;
  sessionId: string | null;
  lastActivity: Date;
  taskQueue: Task[];
  memoryContext: MemoryContext;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  dreamCyclesCompleted: number;
  learningIterations: number;
}

// ============================================================================
// TASK TYPES
// ============================================================================

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus = 
  | 'pending'        // Task is waiting to be processed
  | 'queued'         // Task is in the queue
  | 'running'        // Task is currently being executed
  | 'completed'      // Task completed successfully
  | 'failed'         // Task failed
  | 'cancelled';     // Task was cancelled

export type TaskType = 
  | 'user_input'     // Direct user input
  | 'reasoning'      // LLM reasoning task
  | 'tool_call'      // Tool execution task
  | 'dream_cycle'    // Background dream processing
  | 'memory_consolidation'  // Memory processing
  | 'self_reflection'  // Self-improvement task
  | 'pattern_recognition'  // Pattern analysis
  | 'learning';      // Learning task

export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  input: TaskInput;
  output?: TaskOutput;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retries: number;
  maxRetries: number;
  metadata: Record<string, unknown>;
}

export interface TaskInput {
  content: string;
  context?: ConversationContext;
  tools?: ToolDefinition[];
  constraints?: TaskConstraints;
}

export interface TaskOutput {
  content: string;
  reasoning?: string;
  toolsUsed?: string[];
  tokensUsed: number;
  confidence: number;
}

export interface TaskConstraints {
  maxTokens?: number;
  timeout?: number;
  requiredTools?: string[];
  forbiddenActions?: string[];
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
}

export interface ConversationContext {
  id: string;
  messages: Message[];
  summary?: string;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// TOOL TYPES
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  required: string[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export interface ToolResult {
  toolCallId: string;
  output: unknown;
  isError: boolean;
}

// ============================================================================
// MEMORY TYPES
// ============================================================================

export type MemoryType = 
  | 'episodic'       // Event-based memories
  | 'semantic'       // Fact-based memories
  | 'procedural'     // Skill-based memories
  | 'working';       // Short-term working memory

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  importance: number;
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  expiresAt?: Date;
  associations: string[];
  metadata: Record<string, unknown>;
}

export interface MemoryContext {
  workingMemory: Memory[];
  recentMemories: Memory[];
  relevantMemories: Memory[];
  consolidatedPatterns: Pattern[];
}

export interface Pattern {
  id: string;
  type: 'behavioral' | 'cognitive' | 'performance';
  description: string;
  frequency: number;
  confidence: number;
  lastObserved: Date;
  insights: string[];
}

// ============================================================================
// DREAM CYCLE TYPES
// ============================================================================

export type DreamPhase = 
  | 'init'           // Dream cycle initialization
  | 'memory_scan'    // Scanning memories for patterns
  | 'consolidation'  // Consolidating memories
  | 'pattern_analysis'  // Analyzing patterns
  | 'learning'       // Learning from patterns
  | 'self_improvement'  // Generating improvements
  | 'cleanup'        // Cleaning up old data
  | 'complete';      // Dream cycle complete

export interface DreamCycle {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  phase: DreamPhase;
  memoriesProcessed: number;
  patternsDiscovered: number;
  improvementsGenerated: number;
  insights: DreamInsight[];
}

export interface DreamInsight {
  id: string;
  type: 'pattern' | 'improvement' | 'warning' | 'suggestion';
  content: string;
  relevance: number;
  actionRequired: boolean;
  suggestedAction?: string;
}

// ============================================================================
// LEARNING TYPES
// ============================================================================

export interface LearningExperience {
  id: string;
  taskId: string;
  success: boolean;
  input: string;
  output: string;
  feedback?: string;
  lessonsLearned: string[];
  timestamp: Date;
}

export interface BehaviorAdjustment {
  id: string;
  trigger: string;
  adjustment: string;
  reason: string;
  appliedAt: Date;
  effectiveness: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type NexusEventType = 
  // Agent events
  | 'agent:started'
  | 'agent:stopped'
  | 'agent:status_changed'
  | 'agent:phase_changed'
  | 'agent:error'
  // Task events
  | 'task:created'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:cancelled'
  // Conscious events
  | 'conscious:input_received'
  | 'conscious:reasoning_started'
  | 'conscious:reasoning_completed'
  | 'conscious:tool_call'
  | 'conscious:tool_result'
  // Subconscious events
  | 'subconscious:dream_started'
  | 'subconscious:dream_phase'
  | 'subconscious:dream_completed'
  | 'subconscious:pattern_found'
  | 'subconscious:improvement_generated'
  // Memory events
  | 'memory:stored'
  | 'memory:retrieved'
  | 'memory:consolidated'
  | 'memory:forgotten'
  // Learning events
  | 'learning:experience_recorded'
  | 'learning:behavior_adjusted'
  | 'learning:pattern_learned'
  // Scheduler events
  | 'scheduler:task_scheduled'
  | 'scheduler:task_triggered'
  | 'scheduler:cycle_started'
  // Orchestrator events
  | 'orchestrator:initialized'
  | 'orchestrator:sync_started'
  | 'orchestrator:sync_completed';

export interface NexusEvent {
  type: NexusEventType;
  timestamp: Date;
  data: Record<string, unknown>;
  source: string;
}

export type NexusEventHandler = (event: NexusEvent) => void | Promise<void>;

// ============================================================================
// SCHEDULER TYPES
// ============================================================================

export type ScheduleType = 
  | 'dream_cycle'    // Regular dream cycles
  | 'tool_forge'     // Tool creation/maintenance
  | 'self_reflection'  // Self-reflection sessions
  | 'memory_cleanup'   // Memory cleanup
  | 'behavior_update';  // Behavior rule updates

export interface ScheduledTask {
  id: string;
  type: ScheduleType;
  cron: string;
  lastRun?: Date;
  nextRun: Date;
  enabled: boolean;
  priority: TaskPriority;
  config: Record<string, unknown>;
}

export interface PriorityQueue {
  items: Task[];
  compareFn: (a: Task, b: Task) => number;
}

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

export interface OrchestratorConfig {
  dreamCycleInterval: number;      // ms between dream cycles
  maxConcurrentTasks: number;
  memoryConsolidationThreshold: number;
  reflectionInterval: number;
  enablePerformanceMonitoring: boolean;
}

export interface SyncState {
  lastSync: Date;
  consciousState: AgentState | null;
  subconsciousState: AgentState | null;
  pendingOperations: Operation[];
}

export interface Operation {
  id: string;
  type: string;
  payload: unknown;
  timestamp: Date;
  status: 'pending' | 'applied' | 'failed';
}

// ============================================================================
// LLM TYPES
// ============================================================================

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export type NexusErrorCode = 
  | 'AGENT_NOT_INITIALIZED'
  | 'TASK_EXECUTION_FAILED'
  | 'LLM_ERROR'
  | 'TOOL_ERROR'
  | 'MEMORY_ERROR'
  | 'SCHEDULER_ERROR'
  | 'ORCHESTRATOR_ERROR'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'INVALID_STATE';

export class NexusError extends Error {
  code: NexusErrorCode;
  details?: Record<string, unknown>;

  constructor(code: NexusErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'NexusError';
  }
}

// ============================================================================
// EVENT EMITTER INTERFACE
// ============================================================================

export interface INexusEventEmitter extends EventEmitter {
  emitEvent(event: NexusEvent): void;
  onEvent(type: NexusEventType, handler: NexusEventHandler): void;
  offEvent(type: NexusEventType, handler: NexusEventHandler): void;
}

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

export interface IConscious {
  process(input: string, context?: ConversationContext): Promise<TaskOutput>;
  executeTool(toolCall: ToolCall): Promise<ToolResult>;
  getStatus(): AgentStatus;
}

export interface ISubconscious {
  startDreamCycle(): Promise<DreamCycle>;
  consolidateMemories(): Promise<Memory[]>;
  analyzePatterns(): Promise<Pattern[]>;
  generateImprovements(): Promise<DreamInsight[]>;
  getStatus(): AgentStatus;
}

export interface IAgent {
  initialize(): Promise<void>;
  processInput(input: string): Promise<TaskOutput>;
  getState(): AgentState;
  shutdown(): Promise<void>;
}

export interface IScheduler {
  schedule(task: ScheduledTask): void;
  unschedule(taskId: string): void;
  getNextTask(): ScheduledTask | null;
  start(): void;
  stop(): void;
}

export interface IOrchestrator {
  initialize(): Promise<void>;
  sync(): Promise<void>;
  getSyncState(): SyncState;
  getMetrics(): AgentMetrics;
}
