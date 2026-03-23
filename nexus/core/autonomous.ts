/**
 * NEXUS Autonomous Self-Improvement System
 * 
 * This module enables NEXUS to autonomously improve itself
 * without external input. It runs background tasks to:
 * 
 * - Analyze its own code
 * - Propose improvements
 * - Execute changes
 * - Learn from results
 * - Evolve over time
 */

import ZAI from 'z-ai-web-dev-sdk';
import { codeExecuteTool, CodeExecuteParams } from '../tools/code_execute';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface AutonomousConfig {
  enabled: boolean;
  intervalMs: number;
  maxChangesPerRun: number;
  logFile: string;
  backupEnabled: boolean;
  requireApproval: boolean;
  focusAreas: string[];
}

export interface ImprovementCycle {
  id: string;
  timestamp: Date;
  analysis: string;
  proposedImprovement: string;
  executedChanges: ExecutedChange[];
  result: 'success' | 'partial' | 'failed' | 'skipped';
  learning: string;
}

export interface ExecutedChange {
  file: string;
  action: 'create' | 'modify' | 'delete';
  reason: string;
  success: boolean;
  error?: string;
  backup?: string;
}

export interface SelfImprovementStats {
  totalCycles: number;
  successfulChanges: number;
  failedChanges: number;
  lastRun: Date | null;
  improvementsLog: ImprovementCycle[];
}

// ============================================================================
// Autonomous Self-Improvement System
// ============================================================================

export class AutonomousSystem {
  private config: AutonomousConfig;
  private stats: SelfImprovementStats;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private logPath: string;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  constructor(config?: Partial<AutonomousConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      intervalMs: config?.intervalMs ?? 60 * 60 * 1000,
      maxChangesPerRun: config?.maxChangesPerRun ?? 2,
      logFile: config?.logFile || 'autonomous-log.json',
      backupEnabled: config?.backupEnabled ?? true,
      requireApproval: config?.requireApproval ?? false,
      focusAreas: config?.focusAreas || [
        'performance optimization',
        'error handling',
        'new tools/capabilities',
        'code quality',
        'documentation',
      ],
    };

    this.logPath = join(process.env.HOME || '/root', '.nexus', this.config.logFile);
    this.stats = {
      totalCycles: 0,
      successfulChanges: 0,
      failedChanges: 0,
      lastRun: null,
      improvementsLog: [],
    };

    this.loadStats();
  }

  /**
   * Initialize ZAI
   */
  private async initZAI(): Promise<void> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
  }

  /**
   * Start the autonomous improvement loop
   */
  start(): void {
    if (this.intervalId) {
      console.log('Autonomous system already running');
      return;
    }

    console.log(`🤖 Starting NEXUS Autonomous Self-Improvement System`);
    console.log(`   Interval: ${this.config.intervalMs / 60000} minutes`);
    console.log(`   Max changes per run: ${this.config.maxChangesPerRun}`);

    this.intervalId = setInterval(() => {
      this.runCycle().catch(console.error);
    }, this.config.intervalMs);

    this.isRunning = true;

    // Run first cycle after a short delay
    setTimeout(() => this.runCycle().catch(console.error), 5000);
  }

  /**
   * Stop the autonomous improvement loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Autonomous system stopped');
  }

  /**
   * Run a single improvement cycle
   */
  async runCycle(): Promise<ImprovementCycle> {
    const cycleId = `cycle-${Date.now()}`;
    console.log(`\n🔄 Starting improvement cycle: ${cycleId}`);

    await this.initZAI();

    const cycle: ImprovementCycle = {
      id: cycleId,
      timestamp: new Date(),
      analysis: '',
      proposedImprovement: '',
      executedChanges: [],
      result: 'skipped',
      learning: '',
    };

    try {
      // Step 1: Analyze current state
      const analysis = await this.analyzeSelf();
      cycle.analysis = analysis;

      // Step 2: Propose improvement
      const proposal = await this.proposeImprovement(analysis);
      cycle.proposedImprovement = proposal.improvement;

      // Step 3: Execute changes
      if (proposal.changes && proposal.changes.length > 0) {
        for (const change of proposal.changes.slice(0, this.config.maxChangesPerRun)) {
          const executed = await this.executeChange(change);
          cycle.executedChanges.push(executed);

          if (executed.success) {
            this.stats.successfulChanges++;
          } else {
            this.stats.failedChanges++;
          }
        }
      }

      // Step 4: Determine result
      cycle.result = cycle.executedChanges.length > 0
        ? cycle.executedChanges.some(c => c.success)
          ? cycle.executedChanges.every(c => c.success) ? 'success' : 'partial'
          : 'failed'
        : 'skipped';

      // Step 5: Learn
      cycle.learning = `Completed ${cycle.executedChanges.length} changes with ${cycle.executedChanges.filter(c => c.success).length} successful.`;

    } catch (error) {
      console.error('Cycle error:', error);
      cycle.result = 'failed';
      cycle.learning = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Update stats
    this.stats.totalCycles++;
    this.stats.lastRun = new Date();
    this.stats.improvementsLog.push(cycle);

    // Keep only last 100 cycles
    if (this.stats.improvementsLog.length > 100) {
      this.stats.improvementsLog = this.stats.improvementsLog.slice(-100);
    }

    this.saveStats();

    console.log(`✅ Cycle completed: ${cycle.result}`);
    console.log(`   Changes: ${cycle.executedChanges.length}`);

    return cycle;
  }

  /**
   * Analyze NEXUS's own codebase
   */
  private async analyzeSelf(): Promise<string> {
    // Get file listing
    const listResult = await codeExecuteTool.execute({
      action: 'list_dir',
      path: '/home/z/my-project/nexus/tools',
    });

    const filesInfo = listResult.success
      ? JSON.stringify((listResult.result as any)?.entries || [], null, 2)
      : 'Could not list files';

    const response = await this.zai!.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are NEXUS, an AI agent analyzing your own source code for potential improvements.
Be critical but constructive. Focus on practical improvements.`,
        },
        {
          role: 'user',
          content: `Analyze your current codebase structure:
${filesInfo}

Focus areas: ${this.config.focusAreas.join(', ')}

Provide a brief analysis (2-3 paragraphs) of:
1. Current state assessment
2. Potential improvement opportunities
3. Priority recommendations`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || 'No analysis generated';
  }

  /**
   * Propose a concrete improvement
   */
  private async proposeImprovement(analysis: string): Promise<{
    improvement: string;
    changes: Array<{
      file: string;
      action: 'create' | 'modify';
      content: string;
      reason: string;
    }>;
  }> {
    const response = await this.zai!.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are NEXUS proposing a concrete self-improvement.
Respond in JSON format:
{
  "improvement": "brief description",
  "changes": [
    {
      "file": "path/to/file.ts",
      "action": "create|modify",
      "content": "actual code content",
      "reason": "why this change"
    }
  ]
}

Rules:
- Maximum 2 changes
- Include complete, working code
- Use proper TypeScript types`,
        },
        {
          role: 'user',
          content: `Based on this analysis:
${analysis}

Propose ONE concrete improvement. Be specific and practical.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse improvement proposal');
    }

    return { improvement: 'No valid proposal', changes: [] };
  }

  /**
   * Execute a proposed change
   */
  private async executeChange(change: {
    file: string;
    action: 'create' | 'modify';
    content: string;
    reason: string;
  }): Promise<ExecutedChange> {
    const result: ExecutedChange = {
      file: change.file,
      action: change.action,
      reason: change.reason,
      success: false,
    };

    try {
      // Create backup if enabled and file exists
      if (this.config.backupEnabled && change.action === 'modify') {
        const readResult = await codeExecuteTool.execute({
          action: 'read_file',
          path: change.file,
        });
        if (readResult.success) {
          result.backup = (readResult.result as any)?.content;
        }
      }

      // Execute the change
      const execResult = await codeExecuteTool.execute({
        action: change.action === 'create' ? 'create_file' : 'modify_file',
        path: change.file,
        content: change.content,
      });

      result.success = execResult.success;
      if (!execResult.success) {
        result.error = execResult.error;
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Load stats from disk
   */
  private loadStats(): void {
    try {
      if (existsSync(this.logPath)) {
        const data = JSON.parse(readFileSync(this.logPath, 'utf-8'));
        this.stats = {
          ...this.stats,
          ...data,
          lastRun: data.lastRun ? new Date(data.lastRun) : null,
          improvementsLog: (data.improvementsLog || []).map((c: any) => ({
            ...c,
            timestamp: new Date(c.timestamp),
          })),
        };
      }
    } catch (e) {
      console.warn('Could not load autonomous stats:', e);
    }
  }

  /**
   * Save stats to disk
   */
  private saveStats(): void {
    try {
      const dir = join(process.env.HOME || '/root', '.nexus');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.logPath, JSON.stringify(this.stats, null, 2));
    } catch (e) {
      console.warn('Could not save autonomous stats:', e);
    }
  }

  /**
   * Get current stats
   */
  getStats(): SelfImprovementStats {
    return { ...this.stats };
  }

  /**
   * Check if system is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get configuration
   */
  getConfig(): AutonomousConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutonomousConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.intervalMs && this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let autonomousInstance: AutonomousSystem | null = null;

export function getAutonomousSystem(config?: Partial<AutonomousConfig>): AutonomousSystem {
  if (!autonomousInstance) {
    autonomousInstance = new AutonomousSystem(config);
  }
  return autonomousInstance;
}

export default AutonomousSystem;
