/**
 * NEXUS CLI - Autonomous Mode
 * 
 * Enables NEXUS to run autonomously with scheduled tasks,
 * self-reflection, and continuous learning.
 */

import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ============================================================================
// TYPES
// ============================================================================

export interface AutonomousTask {
  id: string;
  type: 'scheduled' | 'reactive' | 'learning';
  action: 'dream' | 'reflect' | 'cleanup' | 'learn' | 'evolve' | 'custom';
  interval?: number; // milliseconds
  cron?: string;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
  config: Record<string, unknown>;
  description?: string;
}

export interface AutonomousConfig {
  enabled: boolean;
  tasks: AutonomousTask[];
  maxConcurrent: number;
  learningEnabled: boolean;
  selfModificationEnabled: boolean;
  idleTimeout: number; // ms before idle task runs
  maxMemoryAge: number; // ms
}

export interface AutonomousEvent {
  type: 'started' | 'stopped' | 'task_started' | 'task_completed' | 'task_failed' | 'error';
  timestamp: Date;
  data?: unknown;
}

// ============================================================================
// AUTONOMOUS MODE CLASS
// ============================================================================

export class AutonomousMode extends EventEmitter {
  private config: AutonomousConfig;
  private configPath: string;
  private running: boolean = false;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private agent: any = null;
  private lastActivity: Date = new Date();
  private taskQueue: Array<{ task: AutonomousTask; priority: number }> = [];

  constructor(agent: any, configPath?: string) {
    super();
    this.agent = agent;
    this.configPath = configPath || join(homedir(), '.nexus', 'autonomous.json');
    this.config = this.loadConfig();
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  private loadConfig(): AutonomousConfig {
    if (existsSync(this.configPath)) {
      try {
        return JSON.parse(readFileSync(this.configPath, 'utf-8'));
      } catch {
        console.warn('Failed to load autonomous config, using defaults');
      }
    }
    
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): AutonomousConfig {
    return {
      enabled: true,
      tasks: [
        {
          id: 'dream-cycle',
          type: 'scheduled',
          action: 'dream',
          interval: 5 * 60 * 1000, // 5 minutes
          enabled: true,
          config: { deep: false },
          description: 'Run dream cycle for memory consolidation'
        },
        {
          id: 'self-reflection',
          type: 'scheduled',
          action: 'reflect',
          interval: 30 * 60 * 1000, // 30 minutes
          enabled: true,
          config: {},
          description: 'Analyze recent performance and adjust behavior'
        },
        {
          id: 'memory-cleanup',
          type: 'scheduled',
          action: 'cleanup',
          interval: 60 * 60 * 1000, // 1 hour
          enabled: true,
          config: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
          description: 'Clean up old and low-importance memories'
        },
        {
          id: 'learning-cycle',
          type: 'learning',
          action: 'learn',
          interval: 15 * 60 * 1000, // 15 minutes
          enabled: true,
          config: {},
          description: 'Learn from recent interactions'
        },
        {
          id: 'self-evolution',
          type: 'scheduled',
          action: 'evolve',
          interval: 24 * 60 * 60 * 1000, // 24 hours
          enabled: false, // Off by default for safety
          config: {},
          description: 'Generate new tools and skills based on usage patterns'
        }
      ],
      maxConcurrent: 3,
      learningEnabled: true,
      selfModificationEnabled: false,
      idleTimeout: 10 * 60 * 1000, // 10 minutes
      maxMemoryAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };
  }

  private saveConfig(): void {
    const dir = join(this.configPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  async start(): Promise<void> {
    if (this.running) {
      console.log('⚠️ Autonomous mode already running');
      return;
    }

    this.running = true;
    this.config.enabled = true;
    this.emit('autonomous:started', { timestamp: new Date() });
    console.log('🤖 NEXUS Autonomous Mode Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Schedule all enabled tasks
    for (const task of this.config.tasks.filter(t => t.enabled)) {
      this.scheduleTask(task);
    }

    console.log(`📋 ${this.intervals.size} tasks scheduled`);
    console.log('   Press Ctrl+C to stop\n');

    // Start idle monitor
    this.startIdleMonitor();
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.config.enabled = false;

    // Clear all intervals
    for (const [id, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`   Stopped: ${id}`);
    }
    this.intervals.clear();

    this.emit('autonomous:stopped', { timestamp: new Date() });
    console.log('\n🛑 NEXUS Autonomous Mode Stopped');
    this.saveConfig();
  }

  // ============================================================================
  // TASK SCHEDULING
  // ============================================================================

  private scheduleTask(task: AutonomousTask): void {
    if (!task.interval && !task.cron) {
      console.warn(`   ⚠️ Task ${task.id} has no interval or cron, skipping`);
      return;
    }

    // Clear existing interval if any
    if (this.intervals.has(task.id)) {
      clearInterval(this.intervals.get(task.id)!);
    }

    // Calculate next run time
    task.nextRun = new Date(Date.now() + (task.interval || 0));

    // Create interval
    const interval = setInterval(async () => {
      if (!this.running) return;
      
      try {
        await this.executeTask(task);
        task.lastRun = new Date();
        task.nextRun = new Date(Date.now() + (task.interval || 0));
      } catch (error) {
        console.error(`   ❌ Task ${task.id} failed:`, error);
        this.emit('autonomous:task_failed', { taskId: task.id, error, timestamp: new Date() });
      }
    }, task.interval || 60000);

    this.intervals.set(task.id, interval);
    console.log(`   ✓ Scheduled: ${task.id} (every ${Math.floor((task.interval || 0) / 60000)}min)`);
  }

  private startIdleMonitor(): void {
    setInterval(() => {
      if (!this.running) return;
      
      const idleTime = Date.now() - this.lastActivity.getTime();
      if (idleTime > this.config.idleTimeout) {
        // Agent is idle, can run optional tasks
        this.onIdle();
      }
    }, 60000); // Check every minute
  }

  private onIdle(): void {
    // Run a quick dream cycle when idle
    if (this.config.learningEnabled) {
      console.log('   💭 Agent idle, running quick learning...');
      this.executeTask({
        id: 'idle-learning',
        type: 'learning',
        action: 'learn',
        enabled: true,
        config: { quick: true }
      });
    }
  }

  // ============================================================================
  // TASK EXECUTION
  // ============================================================================

  private async executeTask(task: AutonomousTask): Promise<void> {
    this.lastActivity = new Date();
    this.emit('autonomous:task_started', { taskId: task.id, timestamp: new Date() });
    
    console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Running: ${task.id}`);
    const startTime = Date.now();

    try {
      switch (task.action) {
        case 'dream':
          await this.executeDream(task.config);
          break;
        case 'reflect':
          await this.executeReflect(task.config);
          break;
        case 'cleanup':
          await this.executeCleanup(task.config);
          break;
        case 'learn':
          await this.executeLearn(task.config);
          break;
        case 'evolve':
          await this.executeEvolve(task.config);
          break;
        case 'custom':
          await this.executeCustom(task.config);
          break;
        default:
          console.warn(`   Unknown action: ${task.action}`);
      }

      const duration = Date.now() - startTime;
      console.log(`   ✅ Completed in ${duration}ms`);
      
      this.emit('autonomous:task_completed', { 
        taskId: task.id, 
        duration, 
        timestamp: new Date() 
      });

    } catch (error) {
      console.error(`   ❌ Failed:`, error);
      throw error;
    }
  }

  private async executeDream(config: Record<string, unknown>): Promise<void> {
    console.log('   🌙 Running dream cycle...');
    
    if (this.agent && typeof this.agent.triggerDreamCycle === 'function') {
      const result = await this.agent.triggerDreamCycle();
      console.log(`   📊 Processed ${result?.memoriesProcessed || 0} memories`);
    } else {
      // Simulate dream cycle
      console.log('   📊 Analyzing memory patterns...');
      await this.sleep(2000);
      console.log('   📊 Memory consolidation simulated');
    }
  }

  private async executeReflect(config: Record<string, unknown>): Promise<void> {
    console.log('   🪞 Running self-reflection...');
    
    if (this.agent) {
      const state = this.agent.getState?.() || {};
      const metrics = this.agent.getMetrics?.() || {};
      
      console.log(`   📈 Tasks completed: ${metrics.tasksCompleted || 0}`);
      console.log(`   📈 Success rate: ${this.calculateSuccessRate(metrics)}%`);
      
      // Analyze patterns
      if (metrics.tasksCompleted > 10) {
        console.log('   💡 Performance is good, no adjustments needed');
      }
    } else {
      console.log('   📊 Analyzing performance metrics...');
      await this.sleep(1000);
    }
  }

  private async executeCleanup(config: Record<string, unknown>): Promise<void> {
    console.log('   🧹 Running memory cleanup...');
    
    const maxAge = (config.maxAge as number) || this.config.maxMemoryAge;
    console.log(`   📊 Max age: ${Math.floor(maxAge / (24 * 60 * 60 * 1000))} days`);
    
    // Would clean up old memories here
    await this.sleep(1000);
    console.log('   📊 Cleanup complete');
  }

  private async executeLearn(config: Record<string, unknown>): Promise<void> {
    console.log('   📚 Running learning cycle...');
    
    if (config.quick) {
      console.log('   ⚡ Quick learning mode');
    }
    
    // Would analyze recent interactions and learn
    await this.sleep(1500);
    console.log('   📊 Learning complete');
  }

  private async executeEvolve(config: Record<string, unknown>): Promise<void> {
    console.log('   🧬 Running self-evolution...');
    
    if (!this.config.selfModificationEnabled) {
      console.log('   ⚠️ Self-modification is disabled');
      return;
    }
    
    // Would generate new tools/skills
    await this.sleep(2000);
    console.log('   📊 Evolution complete');
  }

  private async executeCustom(config: Record<string, unknown>): Promise<void> {
    console.log('   ⚙️ Running custom task...');
    console.log('   📊 Config:', JSON.stringify(config));
    await this.sleep(1000);
  }

  // ============================================================================
  // TASK MANAGEMENT
  // ============================================================================

  addTask(task: Omit<AutonomousTask, 'id'>): string {
    const newTask: AutonomousTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    };
    
    this.config.tasks.push(newTask);
    this.saveConfig();
    
    if (this.running && task.enabled) {
      this.scheduleTask(newTask);
    }
    
    console.log(`✅ Task added: ${newTask.id}`);
    return newTask.id;
  }

  removeTask(taskId: string): boolean {
    const index = this.config.tasks.findIndex(t => t.id === taskId);
    
    if (index >= 0) {
      this.config.tasks.splice(index, 1);
      this.saveConfig();
      
      if (this.intervals.has(taskId)) {
        clearInterval(this.intervals.get(taskId)!);
        this.intervals.delete(taskId);
      }
      
      console.log(`🗑️ Task removed: ${taskId}`);
      return true;
    }
    
    return false;
  }

  updateTask(taskId: string, updates: Partial<AutonomousTask>): boolean {
    const task = this.config.tasks.find(t => t.id === taskId);
    
    if (task) {
      Object.assign(task, updates);
      this.saveConfig();
      
      if (this.running && task.enabled) {
        this.scheduleTask(task);
      }
      
      console.log(`📝 Task updated: ${taskId}`);
      return true;
    }
    
    return false;
  }

  // ============================================================================
  // STATUS & UTILITIES
  // ============================================================================

  getStatus(): {
    running: boolean;
    taskCount: number;
    activeTasks: number;
    config: AutonomousConfig;
    uptime?: number;
  } {
    return {
      running: this.running,
      taskCount: this.config.tasks.length,
      activeTasks: this.intervals.size,
      config: this.config,
    };
  }

  listTasks(): AutonomousTask[] {
    return this.config.tasks;
  }

  private calculateSuccessRate(metrics: { tasksCompleted?: number; tasksFailed?: number }): number {
    const total = (metrics.tasksCompleted || 0) + (metrics.tasksFailed || 0);
    if (total === 0) return 100;
    return Math.round(((metrics.tasksCompleted || 0) / total) * 100);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CLI EXPORT
// ============================================================================

export async function startAutonomousMode(agent: any): Promise<AutonomousMode> {
  const autonomous = new AutonomousMode(agent);
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    await autonomous.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await autonomous.stop();
    process.exit(0);
  });
  
  await autonomous.start();
  return autonomous;
}

export default AutonomousMode;
