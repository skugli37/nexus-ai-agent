/**
 * NEXUS Core Engine - Main Agent Class
 * 
 * The Agent class is the central hub of NEXUS, coordinating:
 * - Agent state management
 * - Conscious/Subconscious coordination
 * - Session handling
 * - Lifecycle management
 * - Error handling
 * 
 * This is the primary interface for interacting with the NEXUS agent.
 */

import { EventEmitter } from 'events';
import {
  AgentState,
  AgentStatus,
  AgentPhase,
  AgentMetrics,
  Task,
  TaskOutput,
  TaskInput,
  TaskType,
  TaskPriority,
  TaskStatus,
  ConversationContext,
  NexusEvent,
  NexusEventType,
  NexusError,
  IAgent,
} from './types';
import { Conscious, ConsciousConfig } from './conscious';
import { Subconscious, SubconsciousConfig } from './subconscious';

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

export interface AgentConfig {
  id: string;
  name: string;
  conscious?: Partial<ConsciousConfig>;
  subconscious?: Partial<SubconsciousConfig>;
  autoStartDreamCycles: boolean;
  dreamCycleInterval: number;  // ms between automatic dream cycles
  maxTaskRetries: number;
  sessionTimeout: number;  // ms before session expires
}

const DEFAULT_CONFIG: AgentConfig = {
  id: 'nexus-agent',
  name: 'NEXUS',
  autoStartDreamCycles: true,
  dreamCycleInterval: 5 * 60 * 1000, // 5 minutes
  maxTaskRetries: 3,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
};

// ============================================================================
// AGENT IMPLEMENTATION
// ============================================================================

export class Agent extends EventEmitter implements IAgent {
  private config: AgentConfig;
  private state: AgentState;
  private conscious: Conscious;
  private subconscious: Subconscious;
  private initialized: boolean = false;
  private dreamCycleTimer: NodeJS.Timeout | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<AgentConfig> = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize state
    this.state = {
      id: this.config.id,
      status: 'idle',
      phase: 'conscious',
      sessionId: null,
      lastActivity: new Date(),
      taskQueue: [],
      memoryContext: {
        workingMemory: [],
        recentMemories: [],
        relevantMemories: [],
        consolidatedPatterns: []
      },
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageResponseTime: 0,
        totalTokensUsed: 0,
        dreamCyclesCompleted: 0,
        learningIterations: 0
      }
    };

    // Create conscious and subconscious modules
    this.conscious = new Conscious(config.conscious);
    this.subconscious = new Subconscious(config.subconscious);

    // Setup event forwarding
    this.setupEventForwarding();
  }

  // ==========================================================================
  // INITIALIZATION & LIFECYCLE
  // ==========================================================================

  /**
   * Initialize the agent and all its components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('Agent already initialized');
      return;
    }

    try {
      // Initialize conscious module
      await this.conscious.initialize();

      // Initialize subconscious module
      await this.subconscious.initialize();

      // Start automatic dream cycles if enabled
      if (this.config.autoStartDreamCycles) {
        this.startDreamCycleTimer();
      }

      this.initialized = true;
      this.state.status = 'idle';
      
      this.emitEvent('agent:started', {
        agentId: this.state.id,
        phase: this.state.phase
      });

    } catch (error) {
      this.state.status = 'error';
      throw new NexusError(
        'AGENT_NOT_INITIALIZED',
        'Failed to initialize agent',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown(): Promise<void> {
    // Stop timers
    this.stopDreamCycleTimer();
    this.stopSessionTimer();

    // Process remaining tasks in queue
    if (this.state.taskQueue.length > 0) {
      await this.flushTaskQueue();
    }

    // Shutdown subconscious (final consolidation)
    await this.subconscious.shutdown();

    // Reset conscious
    this.conscious.resetContext();

    this.initialized = false;
    this.state.status = 'idle';
    
    this.emitEvent('agent:stopped', { agentId: this.state.id });
  }

  // ==========================================================================
  // INPUT PROCESSING
  // ==========================================================================

  /**
   * Process user input through the conscious module
   */
  async processInput(input: string, context?: ConversationContext): Promise<TaskOutput> {
    this.ensureInitialized();

    // Create task
    const task = this.createTask('user_input', 'high', { content: input, context });

    // Update state
    this.state.status = 'processing';
    this.state.lastActivity = new Date();
    this.emitEvent('agent:status_changed', { status: 'processing' });

    const startTime = Date.now();

    try {
      // Sync memory context from subconscious
      const memoryContext = this.subconscious.getMemoryContext();
      this.conscious.setMemoryContext(memoryContext);

      // Process through conscious
      const output = await this.conscious.process(input, context);

      // Record experience in subconscious
      this.subconscious.recordExperience({
        taskId: task.id,
        success: true,
        input,
        output: output.content,
        lessonsLearned: output.reasoning ? [output.reasoning.slice(0, 200)] : []
      });

      // Update metrics
      this.updateMetrics(Date.now() - startTime, output.tokensUsed, true);

      // Complete task
      task.status = 'completed';
      task.output = output;

      this.state.status = 'idle';
      this.emitEvent('task:completed', { taskId: task.id });
      this.emitEvent('agent:status_changed', { status: 'idle' });

      return output;

    } catch (error) {
      // Record failed experience
      this.subconscious.recordExperience({
        taskId: task.id,
        success: false,
        input,
        output: '',
        feedback: error instanceof Error ? error.message : 'Unknown error',
        lessonsLearned: []
      });

      // Update metrics
      this.updateMetrics(Date.now() - startTime, 0, false);

      // Handle task failure
      task.status = 'failed';
      task.retries++;

      if (task.retries < task.maxRetries) {
        // Requeue task for retry
        this.state.taskQueue.push(task);
        this.emitEvent('task:failed', { taskId: task.id, retries: task.retries });
      } else {
        this.emitEvent('task:failed', { taskId: task.id, maxRetriesReached: true });
      }

      this.state.status = 'idle';
      this.emitEvent('agent:status_changed', { status: 'idle' });

      throw new NexusError(
        'TASK_EXECUTION_FAILED',
        'Failed to process input',
        { error: error instanceof Error ? error.message : 'Unknown error', taskId: task.id }
      );
    }
  }

  /**
   * Execute a specific task type
   */
  async executeTask(type: TaskType, input: TaskInput, priority: TaskPriority = 'medium'): Promise<TaskOutput> {
    this.ensureInitialized();

    const task = this.createTask(type, priority, input);
    return this.processTask(task);
  }

  /**
   * Process a task from the queue
   */
  private async processTask(task: Task): Promise<TaskOutput> {
    this.state.status = 'processing';
    task.status = 'running';
    task.startedAt = new Date();

    this.emitEvent('task:started', { taskId: task.id, type: task.type });

    const startTime = Date.now();

    try {
      const output = await this.conscious.executeTask(task);

      task.status = 'completed';
      task.output = output;
      task.completedAt = new Date();

      this.updateMetrics(Date.now() - startTime, output.tokensUsed, true);
      this.state.metrics.tasksCompleted++;

      this.emitEvent('task:completed', { taskId: task.id });

      return output;

    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date();

      this.updateMetrics(Date.now() - startTime, 0, false);
      this.state.metrics.tasksFailed++;

      this.emitEvent('task:failed', { taskId: task.id, error: error instanceof Error ? error.message : 'Unknown error' });

      throw error;
    } finally {
      this.state.status = 'idle';
    }
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Start a new session
   */
  startSession(sessionId?: string): string {
    const id = sessionId || crypto.randomUUID();
    this.state.sessionId = id;
    this.state.lastActivity = new Date();

    // Start session timeout timer
    this.startSessionTimer();

    this.emitEvent('agent:phase_changed', { phase: 'conscious', sessionId: id });

    return id;
  }

  /**
   * End current session
   */
  endSession(): void {
    if (this.state.sessionId) {
      this.stopSessionTimer();
      
      // Trigger a dream cycle to consolidate session
      this.triggerDreamCycle().catch(console.error);
      
      this.state.sessionId = null;
      this.emitEvent('agent:phase_changed', { phase: 'idle' });
    }
  }

  /**
   * Refresh session activity
   */
  refreshSession(): void {
    if (this.state.sessionId) {
      this.state.lastActivity = new Date();
      this.resetSessionTimer();
    }
  }

  // ==========================================================================
  // DREAM CYCLE MANAGEMENT
  // ==========================================================================

  /**
   * Trigger a dream cycle manually
   */
  async triggerDreamCycle(): Promise<void> {
    if (this.state.phase === 'subconscious') {
      console.warn('Dream cycle already in progress');
      return;
    }

    // Switch to subconscious phase
    const previousPhase = this.state.phase;
    this.state.phase = 'subconscious';
    this.state.status = 'dreaming';
    
    this.emitEvent('agent:phase_changed', { phase: 'subconscious' });

    try {
      const dreamCycle = await this.subconscious.startDreamCycle();
      
      this.state.metrics.dreamCyclesCompleted++;
      this.state.metrics.learningIterations += dreamCycle.patternsDiscovered;

      // Sync memory context back
      this.state.memoryContext = this.subconscious.getMemoryContext();

    } catch (error) {
      this.emitEvent('agent:error', {
        error: error instanceof Error ? error.message : 'Dream cycle failed'
      });
    } finally {
      // Return to previous phase
      this.state.phase = previousPhase;
      this.state.status = 'idle';
      this.emitEvent('agent:phase_changed', { phase: this.state.phase });
    }
  }

  /**
   * Start automatic dream cycle timer
   */
  private startDreamCycleTimer(): void {
    this.stopDreamCycleTimer();
    
    this.dreamCycleTimer = setInterval(() => {
      // Only trigger if idle and no active session
      if (this.state.status === 'idle' && !this.state.sessionId) {
        this.triggerDreamCycle().catch(console.error);
      }
    }, this.config.dreamCycleInterval);
  }

  /**
   * Stop dream cycle timer
   */
  private stopDreamCycleTimer(): void {
    if (this.dreamCycleTimer) {
      clearInterval(this.dreamCycleTimer);
      this.dreamCycleTimer = null;
    }
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.state.metrics };
  }

  /**
   * Get conscious module status
   */
  getConsciousStatus(): AgentStatus {
    return this.conscious.getStatus();
  }

  /**
   * Get subconscious module status
   */
  getSubconsciousStatus(): AgentStatus {
    return this.subconscious.getStatus();
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if agent is busy
   */
  isBusy(): boolean {
    return this.state.status !== 'idle';
  }

  // ==========================================================================
  // TASK QUEUE MANAGEMENT
  // ==========================================================================

  /**
   * Add task to queue
   */
  queueTask(type: TaskType, input: TaskInput, priority: TaskPriority = 'medium'): Task {
    const task = this.createTask(type, priority, input);
    this.state.taskQueue.push(task);
    this.sortTaskQueue();
    
    this.emitEvent('task:created', { taskId: task.id, type, priority });
    
    return task;
  }

  /**
   * Process next task in queue
   */
  async processNextTask(): Promise<TaskOutput | null> {
    if (this.state.taskQueue.length === 0) {
      return null;
    }

    const task = this.state.taskQueue.shift()!;
    return this.processTask(task);
  }

  /**
   * Get pending task count
   */
  getPendingTaskCount(): number {
    return this.state.taskQueue.length;
  }

  /**
   * Clear task queue
   */
  clearTaskQueue(): void {
    for (const task of this.state.taskQueue) {
      task.status = 'cancelled';
      this.emitEvent('task:cancelled', { taskId: task.id });
    }
    this.state.taskQueue = [];
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Ensure agent is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new NexusError('AGENT_NOT_INITIALIZED', 'Agent must be initialized before use');
    }
  }

  /**
   * Create a new task
   */
  private createTask(type: TaskType, priority: TaskPriority, input: TaskInput): Task {
    return {
      id: crypto.randomUUID(),
      type,
      priority,
      status: 'pending',
      input,
      createdAt: new Date(),
      retries: 0,
      maxRetries: this.config.maxTaskRetries,
      metadata: {}
    };
  }

  /**
   * Update agent metrics
   */
  private updateMetrics(responseTime: number, tokensUsed: number, success: boolean): void {
    // Update average response time
    const totalTasks = this.state.metrics.tasksCompleted + this.state.metrics.tasksFailed;
    this.state.metrics.averageResponseTime = 
      (this.state.metrics.averageResponseTime * (totalTasks - 1) + responseTime) / totalTasks;

    // Update total tokens
    this.state.metrics.totalTokensUsed += tokensUsed;

    // Update task counts
    if (success) {
      this.state.metrics.tasksCompleted++;
    } else {
      this.state.metrics.tasksFailed++;
    }
  }

  /**
   * Sort task queue by priority
   */
  private sortTaskQueue(): void {
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };

    this.state.taskQueue.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Flush remaining tasks in queue
   */
  private async flushTaskQueue(): Promise<void> {
    while (this.state.taskQueue.length > 0) {
      try {
        await this.processNextTask();
      } catch (error) {
        console.error('Error flushing task:', error);
      }
    }
  }

  // ==========================================================================
  // SESSION TIMER
  // ==========================================================================

  private startSessionTimer(): void {
    this.stopSessionTimer();
    
    this.sessionTimer = setTimeout(() => {
      this.endSession();
    }, this.config.sessionTimeout);
  }

  private stopSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  private resetSessionTimer(): void {
    this.startSessionTimer();
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Setup event forwarding from modules
   */
  private setupEventForwarding(): void {
    // Forward conscious events
    this.conscious.on('nexus:event', (event: NexusEvent) => {
      this.emit('nexus:event', event);
    });

    // Forward subconscious events
    this.subconscious.on('nexus:event', (event: NexusEvent) => {
      this.emit('nexus:event', event);
    });
  }

  /**
   * Emit a NEXUS event
   */
  private emitEvent(type: NexusEventType, data: Record<string, unknown>): void {
    const event: NexusEvent = {
      type,
      timestamp: new Date(),
      data,
      source: 'agent'
    };
    this.emit('nexus:event', event);
  }

  // ==========================================================================
  // BEHAVIOR ADJUSTMENT
  // ==========================================================================

  /**
   * Apply a behavior adjustment
   */
  applyBehaviorAdjustment(trigger: string, adjustment: string, reason: string): void {
    this.subconscious.applyBehaviorAdjustment({
      trigger,
      adjustment,
      reason
    });
  }

  /**
   * Store a memory
   */
  storeMemory(content: string, type: 'episodic' | 'semantic' | 'procedural' | 'working' = 'episodic', importance: number = 0.5): void {
    this.subconscious.storeMemory(content, type, importance);
  }

  /**
   * Retrieve memories
   */
  retrieveMemories(query: string, limit: number = 10): ReturnType<Subconscious['retrieveMemories']> {
    return this.subconscious.retrieveMemories(query, limit);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Agent;
