/**
 * NEXUS Core Engine - Orchestrator
 * 
 * The Orchestrator is the coordination layer that:
 * - Coordinates all components (Conscious, Subconscious, Agent, Scheduler)
 * - Handles events and event propagation
 * - Manages state synchronization
 * - Monitors performance and health
 * 
 * This is the top-level controller that ensures all parts of NEXUS
 * work together harmoniously.
 */

import { EventEmitter } from 'events';
import {
  AgentState,
  AgentMetrics,
  OrchestratorConfig,
  SyncState,
  Operation,
  NexusEvent,
  NexusEventType,
  NexusEventHandler,
  IOrchestrator,
  NexusError,
  TaskOutput,
  ConversationContext,
  ScheduledTask,
  ScheduleType,
  TaskPriority,
} from './types';
import { Agent, AgentConfig } from './agent';
import { Scheduler, SchedulerConfig } from './scheduler';

// ============================================================================
// ORCHESTRATOR CONFIGURATION
// ============================================================================

const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  dreamCycleInterval: 5 * 60 * 1000,      // 5 minutes
  maxConcurrentTasks: 5,
  memoryConsolidationThreshold: 10,
  reflectionInterval: 60 * 60 * 1000,    // 1 hour
  enablePerformanceMonitoring: true
};

// ============================================================================
// HEALTH STATUS
// ============================================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    agent: ComponentHealth;
    conscious: ComponentHealth;
    subconscious: ComponentHealth;
    scheduler: ComponentHealth;
  };
  uptime: number;
  lastCheck: Date;
}

export interface ComponentHealth {
  status: 'ok' | 'warning' | 'error';
  message: string;
  lastActivity: Date;
  errorCount: number;
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface PerformanceMetrics {
  requestsPerMinute: number;
  averageLatency: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: number;
  activeConnections: number;
}

// ============================================================================
// ORCHESTRATOR IMPLEMENTATION
// ============================================================================

export class Orchestrator extends EventEmitter implements IOrchestrator {
  private config: OrchestratorConfig;
  private agent: Agent;
  private scheduler: Scheduler;
  private initialized: boolean = false;
  private syncState: SyncState;
  private startTime: Date = new Date();
  private eventHandlers: Map<NexusEventType, Set<NexusEventHandler>> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private lastActivities: Map<string, Date> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    agentConfig?: Partial<AgentConfig>,
    schedulerConfig?: Partial<SchedulerConfig>,
    orchestratorConfig?: Partial<OrchestratorConfig>
  ) {
    super();

    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...orchestratorConfig };

    // Create agent and scheduler
    this.agent = new Agent({
      ...agentConfig,
      autoStartDreamCycles: false,  // Orchestrator will manage this
      dreamCycleInterval: this.config.dreamCycleInterval
    });

    this.scheduler = new Scheduler(schedulerConfig);

    // Initialize sync state
    this.syncState = {
      lastSync: new Date(),
      consciousState: null,
      subconsciousState: null,
      pendingOperations: []
    };

    // Setup event routing
    this.setupEventRouting();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the orchestrator and all components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize agent
      await this.agent.initialize();

      // Initialize scheduler
      this.scheduler.start();

      // Setup default scheduled tasks
      this.setupDefaultSchedules();

      // Start performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }

      // Start state synchronization
      this.startStateSync();

      this.initialized = true;
      this.lastActivities.set('orchestrator', new Date());

      this.emitEvent('orchestrator:initialized', {
        agentId: this.agent.getState().id,
        config: this.config
      });

    } catch (error) {
      throw new NexusError(
        'ORCHESTRATOR_ERROR',
        'Failed to initialize orchestrator',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Stop synchronization
    this.stopStateSync();

    // Stop performance monitoring
    this.stopPerformanceMonitoring();

    // Stop scheduler
    this.scheduler.stop();

    // Shutdown agent
    await this.agent.shutdown();

    this.initialized = false;
  }

  // ==========================================================================
  // COMPONENT COORDINATION
  // ==========================================================================

  /**
   * Process input through the coordinated pipeline
   */
  async processInput(input: string, context?: ConversationContext): Promise<TaskOutput> {
    this.ensureInitialized();
    this.lastActivities.set('agent', new Date());

    try {
      const output = await this.agent.processInput(input, context);
      this.errorCounts.set('agent', 0);
      return output;
    } catch (error) {
      this.incrementErrorCount('agent');
      throw error;
    }
  }

  /**
   * Trigger a dream cycle
   */
  async triggerDreamCycle(): Promise<void> {
    this.ensureInitialized();
    this.lastActivities.set('subconscious', new Date());

    try {
      await this.agent.triggerDreamCycle();
      this.errorCounts.set('subconscious', 0);
    } catch (error) {
      this.incrementErrorCount('subconscious');
      throw error;
    }
  }

  /**
   * Start a session
   */
  startSession(sessionId?: string): string {
    this.ensureInitialized();
    return this.agent.startSession(sessionId);
  }

  /**
   * End the current session
   */
  endSession(): void {
    this.agent.endSession();
  }

  // ==========================================================================
  // STATE SYNCHRONIZATION
  // ==========================================================================

  /**
   * Perform state synchronization
   */
  async sync(): Promise<void> {
    const now = new Date();

    // Collect current states
    const agentState = this.agent.getState();
    
    this.syncState = {
      lastSync: now,
      consciousState: {
        ...agentState,
        phase: 'conscious',
        status: this.agent.getConsciousStatus()
      },
      subconsciousState: {
        ...agentState,
        phase: 'subconscious',
        status: this.agent.getSubconsciousStatus()
      },
      pendingOperations: this.syncState.pendingOperations.filter(
        op => op.status === 'pending'
      )
    };

    // Apply pending operations
    await this.applyPendingOperations();

    this.emitEvent('orchestrator:sync_completed', {
      syncTime: now,
      pendingOperations: this.syncState.pendingOperations.length
    });
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Apply pending operations
   */
  private async applyPendingOperations(): Promise<void> {
    const pending = this.syncState.pendingOperations.filter(op => op.status === 'pending');

    for (const operation of pending) {
      try {
        await this.applyOperation(operation);
        operation.status = 'applied';
      } catch (error) {
        operation.status = 'failed';
        console.error('Operation failed:', operation.id, error);
      }
    }
  }

  /**
   * Apply a single operation
   */
  private async applyOperation(operation: Operation): Promise<void> {
    switch (operation.type) {
      case 'behavior_adjustment':
        const { trigger, adjustment, reason } = operation.payload as {
          trigger: string;
          adjustment: string;
          reason: string;
        };
        this.agent.applyBehaviorAdjustment(trigger, adjustment, reason);
        break;

      case 'memory_store':
        const { content, type, importance } = operation.payload as {
          content: string;
          type: 'episodic' | 'semantic' | 'procedural' | 'working';
          importance: number;
        };
        this.agent.storeMemory(content, type, importance);
        break;

      default:
        console.warn('Unknown operation type:', operation.type);
    }
  }

  /**
   * Queue an operation
   */
  queueOperation(type: string, payload: unknown): Operation {
    const operation: Operation = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: new Date(),
      status: 'pending'
    };

    this.syncState.pendingOperations.push(operation);
    return operation;
  }

  /**
   * Start state sync interval
   */
  private startStateSync(): void {
    this.stopStateSync();
    this.syncInterval = setInterval(() => {
      this.sync().catch(console.error);
    }, 10000); // Sync every 10 seconds
  }

  /**
   * Stop state sync interval
   */
  private stopStateSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ==========================================================================
  // SCHEDULING
  // ==========================================================================

  /**
   * Setup default scheduled tasks
   */
  private setupDefaultSchedules(): void {
    // Dream cycle
    const dreamTask = this.scheduler.scheduleDreamCycle(
      Math.floor(this.config.dreamCycleInterval / 60000)
    );
    this.scheduler.registerCallback(dreamTask.id, () => this.agent.triggerDreamCycle());

    // Self-reflection
    const reflectionTask = this.scheduler.scheduleSelfReflection(3); // 3 AM
    this.scheduler.registerCallback(reflectionTask.id, () => this.performSelfReflection());

    // Memory cleanup
    const cleanupTask = this.scheduler.scheduleMemoryCleanup(4); // 4 AM
    this.scheduler.registerCallback(cleanupTask.id, () => this.performMemoryCleanup());

    // Tool forge (weekly on Sunday)
    const forgeTask = this.scheduler.scheduleToolForge(2, 0); // 2 AM Sunday
    this.scheduler.registerCallback(forgeTask.id, () => this.performToolForge());

    // Behavior update
    const behaviorTask = this.scheduler.scheduleBehaviorUpdate(30); // Every 30 minutes
    this.scheduler.registerCallback(behaviorTask.id, () => this.updateBehaviors());
  }

  /**
   * Schedule a custom task
   */
  scheduleTask(type: ScheduleType, cron: string, priority?: TaskPriority): ScheduledTask {
    const task: ScheduledTask = {
      id: `custom-${crypto.randomUUID()}`,
      type,
      cron,
      enabled: true,
      priority: priority || 'medium',
      nextRun: new Date(),
      config: {}
    };

    this.scheduler.schedule(task);
    return task;
  }

  /**
   * Perform self-reflection
   */
  private async performSelfReflection(): Promise<void> {
    this.lastActivities.set('scheduler', new Date());
    // Self-reflection is part of dream cycle
    await this.agent.triggerDreamCycle();
  }

  /**
   * Perform memory cleanup
   */
  private async performMemoryCleanup(): Promise<void> {
    this.lastActivities.set('scheduler', new Date());
    // Memory cleanup is handled by subconscious
    await this.agent.triggerDreamCycle();
  }

  /**
   * Perform tool forge - dynamically create new tools based on patterns
   */
  private async performToolForge(): Promise<void> {
    this.lastActivities.set('scheduler', new Date());
    this.emitEvent('scheduler:task_triggered', { type: 'tool_forge' });

    try {
      // Dynamic import to avoid circular dependencies
      const { ToolForge } = await import('./tool-forge');
      const toolForge = new ToolForge('.nexus/tools');
      await toolForge.initialize();

      // Get recent patterns and experiences from agent
      const state = this.agent.getState();
      const metrics = this.agent.getMetrics();
      
      // Analyze what tools might be needed based on:
      // 1. Frequent operations
      // 2. Failed operations that could be automated
      // 3. New capabilities needed

      const toolSpecs = await this.analyzeToolNeeds(state, metrics);
      
      if (toolSpecs.length === 0) {
        this.emitEvent('subconscious:improvement_generated', { 
          count: 0, 
          reason: 'No new tools needed at this time' 
        });
        return;
      }

      // Generate and test each tool
      for (const spec of toolSpecs) {
        const result = await toolForge.forge(spec);
        
        if (result.success && result.tool) {
          // Test the generated tool
          const testResult = await this.testGeneratedTool(toolForge, result.tool);
          
          if (testResult.success) {
            this.emitEvent('learning:pattern_learned', {
              toolName: spec.name,
              testResult: testResult.output
            });
          } else {
            // Tool failed testing - log and possibly retry
            this.emitEvent('agent:error', {
              error: `Generated tool ${spec.name} failed testing: ${testResult.error}`
            });
          }
        }
      }
    } catch (error) {
      this.emitEvent('agent:error', {
        error: error instanceof Error ? error.message : 'Tool forge failed'
      });
    }
  }

  /**
   * Analyze what tools might be needed
   */
  private async analyzeToolNeeds(
    state: import('./types').AgentState,
    metrics: import('./types').AgentMetrics
  ): Promise<Array<import('./tool-forge').ToolSpec>> {
    const specs: Array<import('./tool-forge').ToolSpec> = [];

    // Analyze based on metrics
    if (metrics.tasksFailed > metrics.tasksCompleted * 0.1) {
      // High failure rate - might need helper tools
      specs.push({
        name: 'error_analyzer',
        description: 'Analyzes errors and suggests solutions',
        inputSchema: {
          error: { type: 'string', description: 'Error message or stack trace', required: true },
          context: { type: 'string', description: 'Context where error occurred' }
        },
        category: 'analysis'
      });
    }

    if (state.memoryContext.recentMemories.length > 50) {
      // Lots of memories - might need memory management tools
      specs.push({
        name: 'memory_summarizer',
        description: 'Summarizes and consolidates memory entries',
        inputSchema: {
          memories: { type: 'array', description: 'Memory entries to summarize', required: true },
          theme: { type: 'string', description: 'Theme to focus on' }
        },
        category: 'data'
      });
    }

    // Only generate tools when there's a clear need
    return specs.slice(0, 2); // Max 2 tools per forge cycle
  }

  /**
   * Test a generated tool
   */
  private async testGeneratedTool(
    toolForge: import('./tool-forge').ToolForge,
    tool: import('./tool-forge').GeneratedTool
  ): Promise<{ success: boolean; output?: unknown; error?: string }> {
    try {
      // Create test inputs based on spec
      const testInputs = this.createTestInputs(tool.spec);
      
      // Try to execute with sandbox
      const { CodeSandbox } = await import('./sandbox');
      const sandbox = new CodeSandbox({ timeout: 5000 });
      
      const result = await sandbox.executeTool(
        tool.code,
        'execute',
        testInputs
      );

      return {
        success: result.success,
        output: result.output,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown test error'
      };
    }
  }

  /**
   * Create test inputs for tool testing
   */
  private createTestInputs(spec: import('./tool-forge').ToolSpec): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    
    for (const [name, param] of Object.entries(spec.inputSchema)) {
      if (param.default !== undefined) {
        inputs[name] = param.default;
      } else if (param.type === 'string') {
        inputs[name] = 'test';
      } else if (param.type === 'number') {
        inputs[name] = 1;
      } else if (param.type === 'boolean') {
        inputs[name] = true;
      } else if (param.type === 'array') {
        inputs[name] = [];
      } else if (param.type === 'object') {
        inputs[name] = {};
      }
    }
    
    return inputs;
  }

  /**
   * Update behaviors based on patterns
   */
  private async updateBehaviors(): Promise<void> {
    this.lastActivities.set('scheduler', new Date());
    // Behavior updates are handled through agent's dream cycle
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Setup event routing from components
   */
  private setupEventRouting(): void {
    // Route agent events
    this.agent.on('nexus:event', (event: NexusEvent) => {
      this.handleEvent(event);
    });

    // Route scheduler events
    this.scheduler.on('nexus:event', (event: NexusEvent) => {
      this.handleEvent(event);
    });
  }

  /**
   * Handle incoming event
   */
  private handleEvent(event: NexusEvent): void {
    // Update last activity
    this.lastActivities.set(event.source, new Date());

    // Dispatch to registered handlers
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      }
    }

    // Also emit to orchestrator listeners
    this.emit('nexus:event', event);

    // Handle specific events
    this.handleSpecialEvents(event);
  }

  /**
   * Handle special events that require orchestrator action
   */
  private handleSpecialEvents(event: NexusEvent): void {
    switch (event.type) {
      case 'agent:error':
        this.incrementErrorCount('agent');
        break;

      case 'subconscious:improvement_generated':
        // Queue improvements for application
        if (event.data.insights) {
          for (const insight of event.data.insights as Array<{actionRequired: boolean; suggestedAction?: string}>) {
            if (insight.actionRequired && insight.suggestedAction) {
              this.queueOperation('behavior_adjustment', {
                trigger: 'dream_cycle',
                adjustment: insight.suggestedAction,
                reason: 'Generated during dream cycle'
              });
            }
          }
        }
        break;
    }
  }

  /**
   * Register an event handler
   */
  onEvent(type: NexusEventType, handler: NexusEventHandler): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);
  }

  /**
   * Unregister an event handler
   */
  offEvent(type: NexusEventType, handler: NexusEventHandler): void {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  // ==========================================================================
  // PERFORMANCE MONITORING
  // ==========================================================================

  private performanceInterval: NodeJS.Timeout | null = null;
  private requestTimes: number[] = [];
  private errorTimes: number[] = [];

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.stopPerformanceMonitoring();
    
    this.performanceInterval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 60000); // Every minute
  }

  /**
   * Stop performance monitoring
   */
  private stopPerformanceMonitoring(): void {
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
      this.performanceInterval = null;
    }
  }

  /**
   * Collect performance metrics
   */
  private collectPerformanceMetrics(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Calculate requests per minute
    const recentRequests = this.requestTimes.filter(t => t > oneMinuteAgo);
    const requestsPerMinute = recentRequests.length;

    // Calculate error rate
    const recentErrors = this.errorTimes.filter(t => t > oneMinuteAgo);
    const errorRate = recentRequests.length > 0 
      ? recentErrors.length / recentRequests.length 
      : 0;

    // Get memory usage
    const memoryUsage = process.memoryUsage();

    const metrics: PerformanceMetrics = {
      requestsPerMinute,
      averageLatency: this.calculateAverageLatency(),
      errorRate,
      memoryUsage,
      activeConnections: 0 // Would be tracked in production
    };

    this.performanceHistory.push(metrics);

    // Keep only last hour of metrics
    if (this.performanceHistory.length > 60) {
      this.performanceHistory.shift();
    }

    this.emit('performance:metrics', metrics);
  }

  /**
   * Calculate average latency from recent requests
   */
  private calculateAverageLatency(): number {
    const agentMetrics = this.agent.getMetrics();
    return agentMetrics.averageResponseTime;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    return this.performanceHistory[this.performanceHistory.length - 1] || null;
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  // ==========================================================================
  // HEALTH CHECKS
  // ==========================================================================

  /**
   * Get health status
   */
  getHealth(): HealthStatus {
    const now = new Date();
    const components = {
      agent: this.getComponentHealth('agent'),
      conscious: this.getComponentHealth('conscious'),
      subconscious: this.getComponentHealth('subconscious'),
      scheduler: this.getComponentHealth('scheduler')
    };

    // Determine overall status
    const hasError = Object.values(components).some(c => c.status === 'error');
    const hasWarning = Object.values(components).some(c => c.status === 'warning');

    const status = hasError ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';

    return {
      status,
      components,
      uptime: now.getTime() - this.startTime.getTime(),
      lastCheck: now
    };
  }

  /**
   * Get health for a specific component
   */
  private getComponentHealth(component: string): ComponentHealth {
    const errorCount = this.errorCounts.get(component) || 0;
    const lastActivity = this.lastActivities.get(component) || this.startTime;

    let status: 'ok' | 'warning' | 'error' = 'ok';
    let message = 'Operating normally';

    if (errorCount > 5) {
      status = 'error';
      message = `High error count: ${errorCount}`;
    } else if (errorCount > 2) {
      status = 'warning';
      message = `Some errors detected: ${errorCount}`;
    }

    // Check for stale activity
    const activityAge = Date.now() - lastActivity.getTime();
    if (activityAge > 5 * 60 * 1000 && component !== 'orchestrator') {
      status = 'warning';
      message = `No activity for ${Math.floor(activityAge / 60000)} minutes`;
    }

    return {
      status,
      message,
      lastActivity,
      errorCount
    };
  }

  // ==========================================================================
  // METRICS & STATISTICS
  // ==========================================================================

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    return this.agent.getMetrics();
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics(): {
    agent: AgentMetrics;
    scheduler: ReturnType<Scheduler['getStats']>;
    performance: PerformanceMetrics | null;
    health: HealthStatus;
  } {
    return {
      agent: this.agent.getMetrics(),
      scheduler: this.scheduler.getStats(),
      performance: this.getPerformanceMetrics(),
      health: this.getHealth()
    };
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Ensure orchestrator is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new NexusError('ORCHESTRATOR_ERROR', 'Orchestrator not initialized');
    }
  }

  /**
   * Increment error count for a component
   */
  private incrementErrorCount(component: string): void {
    const current = this.errorCounts.get(component) || 0;
    this.errorCounts.set(component, current + 1);
  }

  /**
   * Record request time for performance tracking
   */
  recordRequest(): void {
    this.requestTimes.push(Date.now());
    
    // Keep only last hour
    const oneHourAgo = Date.now() - 3600000;
    this.requestTimes = this.requestTimes.filter(t => t > oneHourAgo);
  }

  /**
   * Record error for performance tracking
   */
  recordError(): void {
    this.errorTimes.push(Date.now());
    
    // Keep only last hour
    const oneHourAgo = Date.now() - 3600000;
    this.errorTimes = this.errorTimes.filter(t => t > oneHourAgo);
  }

  /**
   * Get agent instance (for advanced use)
   */
  getAgent(): Agent {
    return this.agent;
  }

  /**
   * Get scheduler instance (for advanced use)
   */
  getScheduler(): Scheduler {
    return this.scheduler;
  }

  /**
   * Check if orchestrator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Emit a NEXUS event
   */
  private emitEvent(type: NexusEventType, data: Record<string, unknown>): void {
    const event: NexusEvent = {
      type,
      timestamp: new Date(),
      data,
      source: 'orchestrator'
    };
    this.emit('nexus:event', event);
  }

  // ==========================================================================
  // RESET & DEBUG
  // ==========================================================================

  /**
   * Reset all components
   */
  async reset(): Promise<void> {
    await this.shutdown();
    
    this.errorCounts.clear();
    this.lastActivities.clear();
    this.performanceHistory = [];
    this.requestTimes = [];
    this.errorTimes = [];
    this.syncState.pendingOperations = [];

    await this.initialize();
  }

  /**
   * Export orchestrator state for debugging
   */
  exportState(): {
    agent: AgentState;
    scheduler: string;
    syncState: SyncState;
    health: HealthStatus;
    performance: PerformanceMetrics | null;
  } {
    return {
      agent: this.agent.getState(),
      scheduler: this.scheduler.exportState(),
      syncState: this.syncState,
      health: this.getHealth(),
      performance: this.getPerformanceMetrics()
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Orchestrator;
