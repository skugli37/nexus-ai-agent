/**
 * NEXUS Core Engine - Subconscious Module
 * 
 * The Subconscious module handles background processing:
 * - Dream cycle processing
 * - Memory consolidation with semantic search
 * - Pattern recognition
 * - Background learning
 * - Self-improvement
 * 
 * Uses VectorStore with real LLM embeddings for semantic memory.
 */

import { EventEmitter } from 'events';
import ZAI from 'z-ai-web-dev-sdk';
import {
  AgentStatus,
  DreamCycle,
  DreamPhase,
  DreamInsight,
  Memory,
  MemoryType,
  Pattern,
  BehaviorAdjustment,
  LearningExperience,
  ISubconscious,
  NexusEvent,
  NexusEventType,
  NexusError,
  MemoryContext,
} from './types';
import { VectorStore, VectorSearchResult } from './vector-store';
import { EmbeddingsEngine } from './embeddings';

// ============================================================================
// SUBCONSCIOUS MODULE CONFIGURATION
// ============================================================================

export interface SubconsciousConfig {
  dreamCycleDuration: number;
  memoryConsolidationThreshold: number;
  patternRecognitionMinSample: number;
  learningRate: number;
  maxMemoryAge: number;
  memoryPath: string;
}

const DEFAULT_CONFIG: SubconsciousConfig = {
  dreamCycleDuration: 5000,
  memoryConsolidationThreshold: 10,
  patternRecognitionMinSample: 5,
  learningRate: 0.1,
  maxMemoryAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  memoryPath: '.nexus/memory'
};

// ============================================================================
// SUBCONSCIOUS MODULE IMPLEMENTATION
// ============================================================================

export class Subconscious extends EventEmitter implements ISubconscious {
  private status: AgentStatus = 'idle';
  private config: SubconsciousConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  
  // Real vector-based memory system
  private vectorStore: VectorStore;
  private embeddings: EmbeddingsEngine;
  
  // Experience and pattern tracking
  private patterns: Pattern[] = [];
  private behaviors: BehaviorAdjustment[] = [];
  private experiences: LearningExperience[] = [];
  private currentDreamCycle: DreamCycle | null = null;
  private isProcessing: boolean = false;
  private initialized: boolean = false;

  constructor(config: Partial<SubconsciousConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize vector store and embeddings
    this.vectorStore = new VectorStore({
      path: this.config.memoryPath,
      collectionName: 'nexus_memories',
      maxResults: 20,
      similarityThreshold: 0.1
    });
    
    this.embeddings = new EmbeddingsEngine();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the subconscious module with vector store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.zai = await ZAI.create();
      
      // Initialize embeddings engine
      await this.embeddings.initialize();
      
      // Initialize vector store
      await this.vectorStore.initialize();
      
      this.initialized = true;
      this.emitEvent('agent:started', { module: 'subconscious', vectorStore: true });
      this.status = 'idle';
    } catch (error) {
      this.status = 'error';
      throw new NexusError(
        'AGENT_NOT_INITIALIZED',
        'Failed to initialize subconscious module',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // ==========================================================================
  // DREAM CYCLE
  // ==========================================================================

  /**
   * Start a dream cycle for background processing
   */
  async startDreamCycle(): Promise<DreamCycle> {
    if (this.isProcessing) {
      throw new NexusError('INVALID_STATE', 'Dream cycle already in progress');
    }

    this.isProcessing = true;
    this.status = 'dreaming';

    const dreamCycle: DreamCycle = {
      id: crypto.randomUUID(),
      startedAt: new Date(),
      phase: 'init',
      memoriesProcessed: 0,
      patternsDiscovered: 0,
      improvementsGenerated: 0,
      insights: []
    };

    this.currentDreamCycle = dreamCycle;
    this.emitEvent('subconscious:dream_started', { dreamCycleId: dreamCycle.id });

    try {
      // Phase 1: Memory Scan using vector store
      await this.dreamPhase(dreamCycle, 'memory_scan', async () => {
        const stats = this.vectorStore.getStats();
        dreamCycle.memoriesProcessed = stats.total;
        return { memoriesFound: stats.total };
      });

      // Phase 2: Consolidation using semantic similarity
      await this.dreamPhase(dreamCycle, 'consolidation', async () => {
        const consolidated = await this.consolidateMemories();
        return { consolidated: consolidated.length };
      });

      // Phase 3: Pattern Analysis
      await this.dreamPhase(dreamCycle, 'pattern_analysis', async () => {
        const patterns = await this.analyzePatterns();
        dreamCycle.patternsDiscovered = patterns.length;
        return { patternsFound: patterns.length };
      });

      // Phase 4: Learning
      await this.dreamPhase(dreamCycle, 'learning', async () => {
        const learned = await this.learnFromExperiences();
        return { lessonsLearned: learned.length };
      });

      // Phase 5: Self-Improvement
      await this.dreamPhase(dreamCycle, 'self_improvement', async () => {
        const improvements = await this.generateImprovements();
        dreamCycle.improvementsGenerated = improvements.length;
        dreamCycle.insights.push(...improvements);
        return { improvementsGenerated: improvements.length };
      });

      // Phase 6: Cleanup
      await this.dreamPhase(dreamCycle, 'cleanup', async () => {
        const cleaned = await this.cleanupOldMemories();
        return { memoriesCleaned: cleaned };
      });

      // Complete
      dreamCycle.phase = 'complete';
      dreamCycle.completedAt = new Date();
      
      this.status = 'idle';
      this.isProcessing = false;
      
      this.emitEvent('subconscious:dream_completed', {
        dreamCycleId: dreamCycle.id,
        memoriesProcessed: dreamCycle.memoriesProcessed,
        patternsDiscovered: dreamCycle.patternsDiscovered,
        improvementsGenerated: dreamCycle.improvementsGenerated
      });

      return dreamCycle;
    } catch (error) {
      this.status = 'error';
      this.isProcessing = false;
      
      this.emitEvent('agent:error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        phase: dreamCycle.phase
      });

      throw new NexusError(
        'TASK_EXECUTION_FAILED',
        'Dream cycle failed',
        { error: error instanceof Error ? error.message : 'Unknown error', phase: dreamCycle.phase }
      );
    }
  }

  /**
   * Execute a single dream phase
   */
  private async dreamPhase(
    dreamCycle: DreamCycle,
    phase: DreamPhase,
    action: () => Promise<Record<string, unknown>>
  ): Promise<void> {
    dreamCycle.phase = phase;
    this.emitEvent('subconscious:dream_phase', { phase, dreamCycleId: dreamCycle.id });

    await action();

    // Allow other operations to proceed
    await this.delay(this.config.dreamCycleDuration);
  }

  // ==========================================================================
  // MEMORY MANAGEMENT WITH VECTOR STORE
  // ==========================================================================

  /**
   * Store a new memory with vector embedding
   */
  async storeMemory(
    content: string,
    type: MemoryType = 'episodic',
    importance: number = 0.5,
    metadata: Record<string, unknown> = {}
  ): Promise<Memory> {
    const memory: Memory = {
      id: crypto.randomUUID(),
      type,
      content,
      importance,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.maxMemoryAge),
      associations: [],
      metadata
    };

    // Store in vector database with embedding
    await this.vectorStore.store(memory);

    this.emitEvent('memory:stored', { memoryId: memory.id, type, vectorStore: true });

    return memory;
  }

  /**
   * Retrieve relevant memories using semantic search
   */
  async retrieveMemories(query: string, limit: number = 10): Promise<Memory[]> {
    // Use vector semantic search
    const results = await this.vectorStore.search(query, limit);
    
    const memories = results.map(r => this.vectorSearchResultToMemory(r));

    this.emitEvent('memory:retrieved', { 
      query, 
      count: memories.length, 
      method: 'semantic_search' 
    });

    return memories;
  }

  /**
   * Get memories by type from vector store
   */
  getMemoriesByType(type: MemoryType): Memory[] {
    const results = this.vectorStore.getByType(type);
    return results.map(r => this.vectorSearchResultToMemory(r));
  }

  /**
   * Consolidate memories using semantic similarity
   */
  async consolidateMemories(): Promise<Memory[]> {
    const stats = this.vectorStore.getStats();
    
    if (stats.total < this.config.memoryConsolidationThreshold) {
      return [];
    }

    this.status = 'learning';
    const consolidated: Memory[] = [];

    // Find similar memory groups using vector similarity
    const similarGroups = await this.vectorStore.findSimilar(0.85);

    for (const group of similarGroups) {
      if (group.memories.length >= 2) {
        // Create consolidated memory from similar ones
        const consolidatedMemory = await this.createConsolidatedMemory(group.memories);
        consolidated.push(consolidatedMemory);

        // Store consolidated memory
        await this.vectorStore.store(consolidatedMemory);

        // Delete original memories
        for (const mem of group.memories) {
          await this.vectorStore.delete(mem.id);
        }

        this.emitEvent('memory:consolidated', {
          originalCount: group.memories.length,
          newMemoryId: consolidatedMemory.id,
          similarity: group.similarity
        });
      }
    }

    this.status = 'idle';
    return consolidated;
  }

  /**
   * Create a consolidated memory from similar memories
   */
  private async createConsolidatedMemory(memories: VectorSearchResult[]): Promise<Memory> {
    const combinedContent = memories.map(m => m.content).join('\n---\n');
    const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
    const totalAccess = memories.reduce((sum, m) => sum + (typeof m.metadata?.accessCount === 'number' ? m.metadata.accessCount : 0), 0);

    return {
      id: crypto.randomUUID(),
      type: memories[0].type,
      content: combinedContent,
      importance: Math.min(1, avgImportance + 0.1),
      accessCount: totalAccess,
      lastAccessed: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.maxMemoryAge),
      associations: [],
      metadata: { 
        consolidated: true, 
        originalCount: memories.length,
        consolidatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Cleanup old or irrelevant memories
   */
  async cleanupOldMemories(): Promise<number> {
    const stats = this.vectorStore.getStats();
    let cleaned = 0;

    // Get all memories and check for cleanup
    const allMemories = this.vectorStore.getByType('episodic')
      .concat(this.vectorStore.getByType('semantic'))
      .concat(this.vectorStore.getByType('procedural'))
      .concat(this.vectorStore.getByType('working'));

    const now = Date.now();

    for (const memory of allMemories) {
      const age = now - memory.createdAt.getTime();
      const daysOld = age / (24 * 60 * 60 * 1000);

      let shouldDelete = false;

      // Check expiration
      if (memory.metadata?.expiresAt) {
        const expiresAt = new Date(memory.metadata.expiresAt as string);
        if (expiresAt.getTime() < now) {
          shouldDelete = true;
        }
      }

      // Check low importance, never accessed
      if (memory.importance < 0.3 && (memory.metadata?.accessCount || 0) === 0 && daysOld > 3) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        await this.vectorStore.delete(memory.id);
        cleaned++;
        this.emitEvent('memory:forgotten', { memoryId: memory.id, reason: 'cleanup' });
      }
    }

    return cleaned;
  }

  // ==========================================================================
  // PATTERN RECOGNITION
  // ==========================================================================

  /**
   * Analyze patterns in experiences and memories
   */
  async analyzePatterns(): Promise<Pattern[]> {
    if (this.experiences.length < this.config.patternRecognitionMinSample) {
      return [];
    }

    this.status = 'reflecting';
    const newPatterns: Pattern[] = [];

    // Analyze success patterns
    const successPattern = this.analyzeSuccessPattern();
    if (successPattern) {
      newPatterns.push(successPattern);
      this.patterns.push(successPattern);
      this.emitEvent('subconscious:pattern_found', {
        type: 'success',
        patternId: successPattern.id
      });
    }

    // Analyze failure patterns
    const failurePattern = this.analyzeFailurePattern();
    if (failurePattern) {
      newPatterns.push(failurePattern);
      this.patterns.push(failurePattern);
      this.emitEvent('subconscious:pattern_found', {
        type: 'failure',
        patternId: failurePattern.id
      });
    }

    // Analyze behavioral patterns
    const behavioralPattern = this.analyzeBehavioralPattern();
    if (behavioralPattern) {
      newPatterns.push(behavioralPattern);
      this.patterns.push(behavioralPattern);
      this.emitEvent('subconscious:pattern_found', {
        type: 'behavioral',
        patternId: behavioralPattern.id
      });
    }

    this.status = 'idle';
    return newPatterns;
  }

  /**
   * Analyze patterns in successful experiences
   */
  private analyzeSuccessPattern(): Pattern | null {
    const successes = this.experiences.filter(e => e.success);
    if (successes.length < this.config.patternRecognitionMinSample) {
      return null;
    }

    const allLessons = successes.flatMap(e => e.lessonsLearned);
    const lessonCounts = this.countOccurrences(allLessons);

    const topLessons = Object.entries(lessonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lesson]) => lesson);

    if (topLessons.length === 0) return null;

    return {
      id: crypto.randomUUID(),
      type: 'performance',
      description: 'Common patterns in successful task completions',
      frequency: successes.length,
      confidence: Math.min(1, successes.length / this.experiences.length),
      lastObserved: new Date(),
      insights: topLessons
    };
  }

  /**
   * Analyze patterns in failed experiences
   */
  private analyzeFailurePattern(): Pattern | null {
    const failures = this.experiences.filter(e => !e.success);
    if (failures.length < 3) return null;

    const commonIssues = this.extractCommonIssues(failures);

    if (commonIssues.length === 0) return null;

    return {
      id: crypto.randomUUID(),
      type: 'cognitive',
      description: 'Common patterns in failed task attempts',
      frequency: failures.length,
      confidence: Math.min(1, failures.length / this.experiences.length),
      lastObserved: new Date(),
      insights: commonIssues
    };
  }

  /**
   * Analyze behavioral patterns
   */
  private analyzeBehavioralPattern(): Pattern | null {
    if (this.behaviors.length < 3) return null;

    const effectiveBehaviors = this.behaviors.filter(b => b.effectiveness > 0.7);
    if (effectiveBehaviors.length < 2) return null;

    return {
      id: crypto.randomUUID(),
      type: 'behavioral',
      description: 'Effective behavior adjustments',
      frequency: effectiveBehaviors.length,
      confidence: effectiveBehaviors.reduce((sum, b) => sum + b.effectiveness, 0) / effectiveBehaviors.length,
      lastObserved: new Date(),
      insights: effectiveBehaviors.map(b => b.adjustment)
    };
  }

  /**
   * Count occurrences of items in an array
   */
  private countOccurrences(items: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item] = (counts[item] || 0) + 1;
    }
    return counts;
  }

  /**
   * Extract common issues from failed experiences
   */
  private extractCommonIssues(failures: LearningExperience[]): string[] {
    const issues: string[] = [];
    
    for (const failure of failures) {
      if (failure.feedback) {
        const words = failure.feedback.toLowerCase().split(/\s+/);
        const issueWords = words.filter(w => 
          ['error', 'failed', 'wrong', 'incorrect', 'missing', 'timeout', 'unable'].some(
            keyword => w.includes(keyword)
          )
        );
        issues.push(...issueWords);
      }
    }

    const counts = this.countOccurrences(issues);
    return Object.entries(counts)
      .filter(([_, count]) => count >= 2)
      .map(([issue]) => issue);
  }

  // ==========================================================================
  // LEARNING
  // ==========================================================================

  /**
   * Record a learning experience
   */
  recordExperience(experience: Omit<LearningExperience, 'id' | 'timestamp'>): LearningExperience {
    const fullExperience: LearningExperience = {
      ...experience,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };

    this.experiences.push(fullExperience);
    this.emitEvent('learning:experience_recorded', {
      experienceId: fullExperience.id,
      success: experience.success
    });

    return fullExperience;
  }

  /**
   * Learn from recorded experiences using LLM
   */
  async learnFromExperiences(): Promise<string[]> {
    const lessons: string[] = [];

    if (this.experiences.length < 3) return lessons;

    if (this.zai) {
      try {
        const recentExperiences = this.experiences.slice(-10);
        const prompt = this.buildLearningPrompt(recentExperiences);

        const completion = await this.zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are a learning system that extracts insights and lessons from experiences. Provide concise, actionable lessons.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 500
        });

        const content = completion.choices[0]?.message?.content || '';
        const extractedLessons = content.split('\n').filter((l: string) => l.trim().length > 0);
        lessons.push(...extractedLessons);
      } catch {
        lessons.push(...this.extractSimpleLessons());
      }
    } else {
      lessons.push(...this.extractSimpleLessons());
    }

    this.emitEvent('learning:pattern_learned', { lessonsCount: lessons.length });

    return lessons;
  }

  /**
   * Build learning prompt for LLM
   */
  private buildLearningPrompt(experiences: LearningExperience[]): string {
    const experienceSummary = experiences.map(e => 
      `Task: ${e.input.slice(0, 100)}...\nSuccess: ${e.success}\nLessons: ${e.lessonsLearned.join(', ')}`
    ).join('\n\n');

    return `Based on these experiences, what are the key lessons to improve performance?

${experienceSummary}

Provide 3-5 concise, actionable lessons:`;
  }

  /**
   * Extract simple lessons without LLM
   */
  private extractSimpleLessons(): string[] {
    const lessons: string[] = [];
    const successes = this.experiences.filter(e => e.success);

    for (const success of successes) {
      lessons.push(...success.lessonsLearned);
    }

    return [...new Set(lessons)].slice(0, 5);
  }

  /**
   * Apply behavior adjustment
   */
  applyBehaviorAdjustment(adjustment: Omit<BehaviorAdjustment, 'id' | 'appliedAt' | 'effectiveness'>): void {
    const fullAdjustment: BehaviorAdjustment = {
      ...adjustment,
      id: crypto.randomUUID(),
      appliedAt: new Date(),
      effectiveness: 0
    };

    this.behaviors.push(fullAdjustment);
    this.emitEvent('learning:behavior_adjusted', {
      adjustmentId: fullAdjustment.id,
      trigger: adjustment.trigger
    });
  }

  // ==========================================================================
  // SELF-IMPROVEMENT
  // ==========================================================================

  /**
   * Generate improvement insights
   */
  async generateImprovements(): Promise<DreamInsight[]> {
    const insights: DreamInsight[] = [];

    for (const pattern of this.patterns) {
      if (pattern.confidence > 0.7 && pattern.type === 'performance') {
        insights.push({
          id: crypto.randomUUID(),
          type: 'improvement',
          content: `Consider applying successful pattern: ${pattern.insights.join(', ')}`,
          relevance: pattern.confidence,
          actionRequired: true,
          suggestedAction: `Incorporate these insights into future tasks: ${pattern.insights.join('; ')}`
        });
      }
    }

    const failurePatterns = this.patterns.filter(p => p.type === 'cognitive');
    for (const pattern of failurePatterns) {
      insights.push({
        id: crypto.randomUUID(),
        type: 'warning',
        content: `Be aware of potential issues: ${pattern.insights.join(', ')}`,
        relevance: pattern.confidence,
        actionRequired: false
      });
    }

    const behavioralPatterns = this.patterns.filter(p => p.type === 'behavioral');
    for (const pattern of behavioralPatterns) {
      insights.push({
        id: crypto.randomUUID(),
        type: 'suggestion',
        content: `Effective behavior found: ${pattern.insights[0]}`,
        relevance: pattern.confidence,
        actionRequired: true,
        suggestedAction: `Consider making this behavior a default practice`
      });
    }

    this.emitEvent('subconscious:improvement_generated', { count: insights.length });

    return insights;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get memory context for conscious module using semantic search
   */
  async getMemoryContextForQuery(query: string): Promise<MemoryContext> {
    const relevantMemories = await this.retrieveMemories(query, 10);
    const recentMemories = this.getRecentMemories(20);

    return {
      workingMemory: recentMemories.slice(0, 5),
      recentMemories,
      relevantMemories,
      consolidatedPatterns: this.patterns
    };
  }

  /**
   * Get memory context for conscious module (synchronous fallback)
   */
  getMemoryContext(): MemoryContext {
    const recentMemories = this.getRecentMemories(20);

    return {
      workingMemory: recentMemories.slice(0, 5),
      recentMemories,
      relevantMemories: [],
      consolidatedPatterns: this.patterns
    };
  }

  /**
   * Get recent memories from vector store
   */
  private getRecentMemories(limit: number): Memory[] {
    const stats = this.vectorStore.getStats();
    // Get by type and combine
    const all = [
      ...this.vectorStore.getByType('episodic'),
      ...this.vectorStore.getByType('semantic'),
      ...this.vectorStore.getByType('procedural')
    ];
    
    // Sort by creation date and take recent
    return all
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(r => this.vectorSearchResultToMemory(r));
  }

  /**
   * Convert vector search result to Memory
   */
  private vectorSearchResultToMemory(r: VectorSearchResult): Memory {
    return {
      id: r.id,
      type: r.type,
      content: r.content,
      importance: r.importance,
      accessCount: typeof r.metadata?.accessCount === 'number' ? r.metadata.accessCount : 0,
      lastAccessed: r.lastAccessed,
      createdAt: r.createdAt,
      associations: [],
      metadata: r.metadata
    };
  }

  /**
   * Get all patterns
   */
  getPatterns(): Pattern[] {
    return this.patterns;
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): ReturnType<VectorStore['getStats']> {
    return this.vectorStore.getStats();
  }

  /**
   * Get all memories (from vector store)
   */
  getMemories(): Memory[] {
    const stats = this.vectorStore.getStats();
    const all: Memory[] = [];
    
    for (const type of ['episodic', 'semantic', 'procedural', 'working'] as MemoryType[]) {
      const results = this.vectorStore.getByType(type);
      all.push(...results.map(r => this.vectorSearchResultToMemory(r)));
    }
    
    return all;
  }

  /**
   * Get current dream cycle
   */
  getCurrentDreamCycle(): DreamCycle | null {
    return this.currentDreamCycle;
  }

  /**
   * Check if currently processing
   */
  isBusy(): boolean {
    return this.isProcessing;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get vector store instance
   */
  getVectorStore(): VectorStore {
    return this.vectorStore;
  }

  /**
   * Get embeddings engine instance
   */
  getEmbeddings(): EmbeddingsEngine {
    return this.embeddings;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      source: 'subconscious'
    };
    this.emit('nexus:event', event);
  }

  // ==========================================================================
  // RESET & CLEANUP
  // ==========================================================================

  /**
   * Reset the subconscious state
   */
  async reset(): Promise<void> {
    await this.vectorStore.clear();
    this.patterns = [];
    this.behaviors = [];
    this.experiences = [];
    this.currentDreamCycle = null;
    this.status = 'idle';
    this.isProcessing = false;
  }

  /**
   * Shutdown the subconscious module
   */
  async shutdown(): Promise<void> {
    if (this.vectorStore.getStats().total > 0) {
      await this.consolidateMemories();
    }
    this.status = 'idle';
    this.initialized = false;
  }
}

export default Subconscious;
