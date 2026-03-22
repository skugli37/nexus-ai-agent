/**
 * NEXUS Core Engine - Task Scheduler
 * 
 * The Scheduler module handles all scheduled tasks:
 * - Dream cycle scheduling
 * - Tool forge scheduling
 * - Self-reflection scheduling
 * - Cron-like functionality
 * - Priority queue management
 * 
 * This module enables NEXUS to operate autonomously with scheduled
 * background tasks and maintenance cycles.
 */

import { EventEmitter } from 'events';
import {
  ScheduledTask,
  ScheduleType,
  TaskPriority,
  IScheduler,
  NexusEvent,
  NexusEventType,
  NexusError,
  Task,
  TaskType,
  TaskStatus,
} from './types';

// ============================================================================
// SCHEDULER CONFIGURATION
// ============================================================================

export interface SchedulerConfig {
  maxConcurrentTasks: number;
  defaultPriority: TaskPriority;
  tickInterval: number;  // ms between scheduler ticks
  enablePersistence: boolean;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrentTasks: 3,
  defaultPriority: 'medium',
  tickInterval: 1000,  // 1 second
  enablePersistence: false
};

// ============================================================================
// CRON EXPRESSION PARSER
// ============================================================================

interface CronFields {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/**
 * Parse cron expression to field arrays
 */
function parseCron(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  
  if (parts.length !== 5) {
    throw new NexusError('SCHEDULER_ERROR', 'Invalid cron expression', { expression });
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  return {
    minute: parseCronField(minute, 0, 59),
    hour: parseCronField(hour, 0, 23),
    dayOfMonth: parseCronField(dayOfMonth, 1, 31),
    month: parseCronField(month, 1, 12),
    dayOfWeek: parseCronField(dayOfWeek, 0, 6)
  };
}

/**
 * Parse a single cron field
 */
function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  const values: number[] = [];
  const segments = field.split(',');

  for (const segment of segments) {
    if (segment.includes('/')) {
      // Handle step values (e.g., */5)
      const [base, step] = segment.split('/');
      const stepNum = parseInt(step, 10);
      const range = base === '*' 
        ? { start: min, end: max }
        : parseRange(base, min, max);

      for (let i = range.start; i <= range.end; i += stepNum) {
        values.push(i);
      }
    } else if (segment.includes('-')) {
      // Handle ranges (e.g., 1-5)
      const range = parseRange(segment, min, max);
      for (let i = range.start; i <= range.end; i++) {
        values.push(i);
      }
    } else {
      // Single value
      const num = parseInt(segment, 10);
      if (num >= min && num <= max) {
        values.push(num);
      }
    }
  }

  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Parse a range expression
 */
function parseRange(range: string, min: number, max: number): { start: number; end: number } {
  const [startStr, endStr] = range.split('-');
  const start = Math.max(min, parseInt(startStr, 10));
  const end = Math.min(max, parseInt(endStr, 10));
  return { start, end };
}

/**
 * Calculate next occurrence from cron fields
 */
function getNextOccurrence(cron: CronFields, from: Date): Date {
  const next = new Date(from);
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  // Add one minute to start from next minute
  next.setMinutes(next.getMinutes() + 1);

  // Find next matching time (with limit to prevent infinite loop)
  const maxIterations = 366 * 24 * 60; // Max one year in minutes
  let iterations = 0;

  while (iterations < maxIterations) {
    const minute = next.getMinutes();
    const hour = next.getHours();
    const dayOfMonth = next.getDate();
    const month = next.getMonth() + 1;
    const dayOfWeek = next.getDay();

    if (
      cron.minute.includes(minute) &&
      cron.hour.includes(hour) &&
      cron.dayOfMonth.includes(dayOfMonth) &&
      cron.month.includes(month) &&
      cron.dayOfWeek.includes(dayOfWeek)
    ) {
      return next;
    }

    // Advance by one minute
    next.setMinutes(next.getMinutes() + 1);
    iterations++;
  }

  throw new NexusError('SCHEDULER_ERROR', 'Could not find next occurrence within reasonable time');
}

// ============================================================================
// PRIORITY QUEUE IMPLEMENTATION
// ============================================================================

interface PriorityQueueItem {
  task: ScheduledTask;
  scheduledTime: Date;
}

class PriorityQueue {
  private items: PriorityQueueItem[] = [];

  enqueue(item: PriorityQueueItem): void {
    this.items.push(item);
    this.sort();
  }

  dequeue(): PriorityQueueItem | undefined {
    return this.items.shift();
  }

  peek(): PriorityQueueItem | undefined {
    return this.items[0];
  }

  remove(taskId: string): boolean {
    const index = this.items.findIndex(item => item.task.id === taskId);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.items = [];
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  getAll(): PriorityQueueItem[] {
    return [...this.items];
  }

  private sort(): void {
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };

    this.items.sort((a, b) => {
      // First by scheduled time
      const timeDiff = a.scheduledTime.getTime() - b.scheduledTime.getTime();
      if (timeDiff !== 0) return timeDiff;

      // Then by priority
      return priorityOrder[a.task.priority] - priorityOrder[b.task.priority];
    });
  }
}

// ============================================================================
// SCHEDULER IMPLEMENTATION
// ============================================================================

export class Scheduler extends EventEmitter implements IScheduler {
  private config: SchedulerConfig;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private priorityQueue: PriorityQueue = new PriorityQueue();
  private cronCache: Map<string, CronFields> = new Map();
  private tickTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private taskCallbacks: Map<string, () => Promise<void>> = new Map();

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // SCHEDULING METHODS
  // ==========================================================================

  /**
   * Schedule a new task
   */
  schedule(task: ScheduledTask): void {
    // Validate task
    if (!task.id || !task.type || !task.cron) {
      throw new NexusError('SCHEDULER_ERROR', 'Invalid task: missing required fields');
    }

    // Parse and cache cron expression
    if (!this.cronCache.has(task.cron)) {
      this.cronCache.set(task.cron, parseCron(task.cron));
    }

    // Calculate next run time
    const cronFields = this.cronCache.get(task.cron)!;
    task.nextRun = getNextOccurrence(cronFields, task.lastRun || new Date());

    // Store task
    this.scheduledTasks.set(task.id, task);

    // Add to priority queue
    this.priorityQueue.enqueue({
      task,
      scheduledTime: task.nextRun
    });

    this.emitEvent('scheduler:task_scheduled', {
      taskId: task.id,
      type: task.type,
      nextRun: task.nextRun.toISOString()
    });
  }

  /**
   * Unschedule a task
   */
  unschedule(taskId: string): void {
    this.scheduledTasks.delete(taskId);
    this.priorityQueue.remove(taskId);
    this.taskCallbacks.delete(taskId);
  }

  /**
   * Register a callback for a scheduled task
   */
  registerCallback(taskId: string, callback: () => Promise<void>): void {
    this.taskCallbacks.set(taskId, callback);
  }

  // ==========================================================================
  // CONVENIENCE METHODS FOR COMMON SCHEDULE TYPES
  // ==========================================================================

  /**
   * Schedule a dream cycle
   */
  scheduleDreamCycle(intervalMinutes: number = 5, priority: TaskPriority = 'low'): ScheduledTask {
    const task: ScheduledTask = {
      id: `dream-cycle-${crypto.randomUUID()}`,
      type: 'dream_cycle',
      cron: `*/${intervalMinutes} * * * *`,  // Every N minutes
      enabled: true,
      priority,
      nextRun: new Date(),
      config: { intervalMinutes }
    };

    this.schedule(task);
    return task;
  }

  /**
   * Schedule a self-reflection session
   */
  scheduleSelfReflection(hour: number = 3, priority: TaskPriority = 'medium'): ScheduledTask {
    const task: ScheduledTask = {
      id: `self-reflection-${crypto.randomUUID()}`,
      type: 'self_reflection',
      cron: `0 ${hour} * * *`,  // Daily at specified hour
      enabled: true,
      priority,
      nextRun: new Date(),
      config: { hour }
    };

    this.schedule(task);
    return task;
  }

  /**
   * Schedule memory cleanup
   */
  scheduleMemoryCleanup(hour: number = 4, priority: TaskPriority = 'low'): ScheduledTask {
    const task: ScheduledTask = {
      id: `memory-cleanup-${crypto.randomUUID()}`,
      type: 'memory_cleanup',
      cron: `0 ${hour} * * *`,  // Daily at specified hour
      enabled: true,
      priority,
      nextRun: new Date(),
      config: { hour }
    };

    this.schedule(task);
    return task;
  }

  /**
   * Schedule a tool forge session
   */
  scheduleToolForge(hour: number = 2, dayOfWeek: number = 0, priority: TaskPriority = 'medium'): ScheduledTask {
    const task: ScheduledTask = {
      id: `tool-forge-${crypto.randomUUID()}`,
      type: 'tool_forge',
      cron: `0 ${hour} * * ${dayOfWeek}`,  // Weekly on specified day
      enabled: true,
      priority,
      nextRun: new Date(),
      config: { hour, dayOfWeek }
    };

    this.schedule(task);
    return task;
  }

  /**
   * Schedule behavior update
   */
  scheduleBehaviorUpdate(intervalMinutes: number = 30, priority: TaskPriority = 'low'): ScheduledTask {
    const task: ScheduledTask = {
      id: `behavior-update-${crypto.randomUUID()}`,
      type: 'behavior_update',
      cron: `*/${intervalMinutes} * * * *`,  // Every N minutes
      enabled: true,
      priority,
      nextRun: new Date(),
      config: { intervalMinutes }
    };

    this.schedule(task);
    return task;
  }

  // ==========================================================================
  // SCHEDULER CONTROL
  // ==========================================================================

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.tickTimer = setInterval(() => this.tick(), this.config.tickInterval);

    this.emitEvent('scheduler:cycle_started', {
      scheduledTasks: this.scheduledTasks.size,
      tickInterval: this.config.tickInterval
    });
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ==========================================================================
  // TASK EXECUTION
  // ==========================================================================

  /**
   * Main scheduler tick
   */
  private async tick(): Promise<void> {
    if (this.priorityQueue.isEmpty()) {
      return;
    }

    const now = new Date();
    const tasksToExecute: PriorityQueueItem[] = [];

    // Find all tasks that should run now
    while (!this.priorityQueue.isEmpty()) {
      const item = this.priorityQueue.peek();
      
      if (item && item.scheduledTime <= now) {
        tasksToExecute.push(this.priorityQueue.dequeue()!);
      } else {
        break;
      }
    }

    // Execute tasks (respecting max concurrent limit)
    const executing = tasksToExecute.slice(0, this.config.maxConcurrentTasks);
    
    for (const item of executing) {
      await this.executeScheduledTask(item.task);
      
      // Reschedule if still enabled
      if (item.task.enabled) {
        this.rescheduleTask(item.task);
      }
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeScheduledTask(task: ScheduledTask): Promise<void> {
    this.emitEvent('scheduler:task_triggered', {
      taskId: task.id,
      type: task.type
    });

    const callback = this.taskCallbacks.get(task.id);
    
    if (callback) {
      try {
        await callback();
        task.lastRun = new Date();
      } catch (error) {
        console.error(`Scheduled task ${task.id} failed:`, error);
      }
    } else {
      // Emit event for external handlers
      this.emit('task:execute', task);
    }
  }

  /**
   * Reschedule a task for its next occurrence
   */
  private rescheduleTask(task: ScheduledTask): void {
    const cronFields = this.cronCache.get(task.cron);
    
    if (cronFields) {
      task.nextRun = getNextOccurrence(cronFields, new Date());
      
      this.priorityQueue.enqueue({
        task,
        scheduledTime: task.nextRun
      });
    }
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Get next scheduled task
   */
  getNextTask(): ScheduledTask | null {
    const item = this.priorityQueue.peek();
    return item ? item.task : null;
  }

  /**
   * Get all scheduled tasks
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: ScheduleType): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values()).filter(t => t.type === type);
  }

  /**
   * Get next run time for a task
   */
  getNextRun(taskId: string): Date | null {
    const task = this.scheduledTasks.get(taskId);
    return task ? task.nextRun : null;
  }

  /**
   * Get time until next task
   */
  getTimeUntilNext(): number | null {
    const item = this.priorityQueue.peek();
    if (!item) return null;
    
    return Math.max(0, item.scheduledTime.getTime() - Date.now());
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.priorityQueue.size();
  }

  // ==========================================================================
  // TASK MANAGEMENT
  // ==========================================================================

  /**
   * Enable a task
   */
  enableTask(taskId: string): boolean {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a task
   */
  disableTask(taskId: string): boolean {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.enabled = false;
      this.priorityQueue.remove(taskId);
      return true;
    }
    return false;
  }

  /**
   * Update task configuration
   */
  updateTask(taskId: string, updates: Partial<ScheduledTask>): boolean {
    const task = this.scheduledTasks.get(taskId);
    if (!task) return false;

    // Apply updates
    Object.assign(task, updates);

    // If cron changed, recalculate next run
    if (updates.cron) {
      this.cronCache.delete(updates.cron);
      const cronFields = parseCron(updates.cron);
      this.cronCache.set(updates.cron, cronFields);
      task.nextRun = getNextOccurrence(cronFields, new Date());
      
      // Re-add to queue
      this.priorityQueue.remove(taskId);
      this.priorityQueue.enqueue({ task, scheduledTime: task.nextRun });
    }

    return true;
  }

  /**
   * Clear all scheduled tasks
   */
  clearAll(): void {
    this.scheduledTasks.clear();
    this.priorityQueue.clear();
    this.cronCache.clear();
    this.taskCallbacks.clear();
  }

  // ==========================================================================
  // AD-HOC TASKS
  // ==========================================================================

  /**
   * Schedule a one-time task
   */
  scheduleOnce(
    type: ScheduleType,
    delayMs: number,
    priority: TaskPriority = 'medium',
    config: Record<string, unknown> = {}
  ): ScheduledTask {
    const scheduledTime = new Date(Date.now() + delayMs);
    
    const task: ScheduledTask = {
      id: `adhoc-${crypto.randomUUID()}`,
      type,
      cron: '',  // No cron for one-time tasks
      enabled: true,
      priority,
      nextRun: scheduledTime,
      config: { ...config, once: true }
    };

    // For one-time tasks, we bypass the cron system
    this.scheduledTasks.set(task.id, task);
    this.priorityQueue.enqueue({ task, scheduledTime });

    // Auto-remove after execution
    this.registerCallback(task.id, async () => {
      this.unschedule(task.id);
    });

    return task;
  }

  // ==========================================================================
  // EVENT EMISSION
  // ==========================================================================

  /**
   * Emit a NEXUS event
   */
  private emitEvent(type: NexusEventType, data: Record<string, unknown>): void {
    const event: NexusEvent = {
      type,
      timestamp: new Date(),
      data,
      source: 'scheduler'
    };
    this.emit('nexus:event', event);
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get scheduler statistics
   */
  getStats(): {
    totalTasks: number;
    enabledTasks: number;
    nextRunIn: number | null;
    isRunning: boolean;
  } {
    const enabled = Array.from(this.scheduledTasks.values()).filter(t => t.enabled);
    
    return {
      totalTasks: this.scheduledTasks.size,
      enabledTasks: enabled.length,
      nextRunIn: this.getTimeUntilNext(),
      isRunning: this.isRunning
    };
  }

  /**
   * Export scheduler state
   */
  exportState(): string {
    const tasks = Array.from(this.scheduledTasks.values());
    return JSON.stringify(tasks, null, 2);
  }

  /**
   * Import scheduler state
   */
  importState(json: string): number {
    try {
      const tasks: ScheduledTask[] = JSON.parse(json);
      
      for (const task of tasks) {
        // Restore date objects
        if (typeof task.nextRun === 'string') {
          task.nextRun = new Date(task.nextRun);
        }
        if (task.lastRun && typeof task.lastRun === 'string') {
          task.lastRun = new Date(task.lastRun);
        }
        
        this.schedule(task);
      }
      
      return tasks.length;
    } catch (error) {
      throw new NexusError('SCHEDULER_ERROR', 'Failed to import scheduler state', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Scheduler;
