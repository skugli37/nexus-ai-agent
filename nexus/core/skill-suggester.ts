/**
 * NEXUS Skill Suggester - AI-Powered Skill Recommendations
 * 
 * Uses embeddings and AI analysis to suggest relevant skills for tasks:
 * - Analyzes task requirements
 * - Searches matching skills
 * - Ranks by relevance using embeddings
 * - Considers user history and preferences
 */

import ZAI from 'z-ai-web-dev-sdk';
import { ClawHubClient, ClawHubSkill, SearchOptions } from './clawhub-client';
import { EmbeddingsEngine } from './embeddings';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface TaskAnalysis {
  type: string;
  domain: string;
  requiredCapabilities: string[];
  keywords: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  suggestedCategories: string[];
  confidence: number;
}

export interface SkillRecommendation {
  skill: ClawHubSkill;
  relevanceScore: number;
  matchReasons: string[];
  capabilityMatches: string[];
  suggestedUseCase?: string;
}

export interface SuggestionContext {
  taskDescription: string;
  conversationHistory?: string[];
  installedSkills?: string[];
  userPreferences?: UserPreferences;
  maxSuggestions?: number;
  minRelevanceScore?: number;
}

export interface UserPreferences {
  preferredCategories?: string[];
  preferredAuthors?: string[];
  minRating?: number;
  excludeTags?: string[];
  prioritizeInstalled?: boolean;
}

export interface SuggestionResult {
  recommendations: SkillRecommendation[];
  analysis: TaskAnalysis;
  searchQueries: string[];
  totalCandidates: number;
  processingTime: number;
}

export interface SkillEmbedding {
  skillId: string;
  embedding: number[];
  lastUpdated: number;
}

// ============================================================================
// Skill Suggester Implementation
// ============================================================================

export class SkillSuggester {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private clawhub: ClawHubClient;
  private embeddingsEngine: EmbeddingsEngine;
  private skillEmbeddings: Map<string, SkillEmbedding> = new Map();
  private cachePath: string;
  private initialized: boolean = false;

  // Domain keyword mappings
  private readonly domainKeywords: Record<string, string[]> = {
    coding: ['code', 'programming', 'function', 'class', 'debug', 'refactor', 'typescript', 'javascript', 'python', 'api'],
    writing: ['write', 'article', 'blog', 'content', 'copy', 'edit', 'proofread', 'document'],
    analysis: ['analyze', 'data', 'metrics', 'report', 'insight', 'statistics', 'trend'],
    research: ['research', 'search', 'find', 'gather', 'information', 'source', 'cite'],
    automation: ['automate', 'workflow', 'pipeline', 'schedule', 'trigger', 'batch'],
    communication: ['email', 'message', 'chat', 'respond', 'reply', 'notification'],
    design: ['design', 'ui', 'ux', 'visual', 'layout', 'component', 'style'],
    testing: ['test', 'unit', 'integration', 'qa', 'coverage', 'spec', 'assert'],
    deployment: ['deploy', 'release', 'ci', 'cd', 'pipeline', 'environment', 'production'],
    documentation: ['document', 'readme', 'guide', 'tutorial', 'explain', 'comment'],
  };

  // Capability patterns
  private readonly capabilityPatterns: Record<string, RegExp[]> = {
    'web_search': [/\b(search|find|look up|query|google|browse)\b/gi],
    'code_execution': [/\b(execute|run|script|code|program)\b/gi],
    'file_operations': [/\b(read|write|save|load|file|document)\b/gi],
    'api_integration': [/\b(api|endpoint|request|rest|graphql)\b/gi],
    'data_processing': [/\b(process|transform|parse|convert|format)\b/gi],
    'ai_generation': [/\b(generate|create|write|compose|produce)\b/gi],
    'analysis': [/\b(analyze|evaluate|assess|review|examine)\b/gi],
    'visualization': [/\b(visualize|chart|graph|plot|display)\b/gi],
  };

  constructor(
    clawhubClient?: ClawHubClient,
    cachePath?: string
  ) {
    this.clawhub = clawhubClient || new ClawHubClient();
    this.embeddingsEngine = new EmbeddingsEngine();
    this.cachePath = cachePath || join(process.cwd(), '.nexus', 'cache', 'suggestions');
  }

  /**
   * Initialize the skill suggester
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.zai = await ZAI.create();
    } catch (error) {
      console.warn('SkillSuggester: Failed to initialize AI SDK, using fallback methods');
    }

    await this.clawhub.initialize();
    await this.embeddingsEngine.initialize();

    // Load cached skill embeddings
    await this.loadCachedEmbeddings();

    // Ensure cache directory exists
    if (!existsSync(this.cachePath)) {
      mkdirSync(this.cachePath, { recursive: true });
    }

    this.initialized = true;
  }

  // ============================================================================
  // Main Suggestion Methods
  // ============================================================================

  /**
   * Get skill suggestions for a task
   */
  async suggest(context: SuggestionContext): Promise<SuggestionResult> {
    await this.ensureInitialized();
    const startTime = Date.now();

    // 1. Analyze the task
    const analysis = await this.analyzeTask(context.taskDescription);

    // 2. Build search queries from analysis
    const searchQueries = this.buildSearchQueries(analysis, context);

    // 3. Search for candidate skills
    const candidates = await this.searchCandidates(searchQueries, context);

    // 4. Rank candidates by relevance
    const recommendations = await this.rankCandidates(
      candidates,
      context.taskDescription,
      analysis,
      context
    );

    // 5. Apply filters and limits
    const filtered = this.applyFilters(recommendations, context);

    return {
      recommendations: filtered,
      analysis,
      searchQueries,
      totalCandidates: candidates.length,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Quick suggestion for a simple query
   */
  async quickSuggest(query: string, limit: number = 5): Promise<SkillRecommendation[]> {
    const result = await this.suggest({
      taskDescription: query,
      maxSuggestions: limit,
    });
    return result.recommendations;
  }

  /**
   * Analyze a task description
   */
  async analyzeTask(taskDescription: string): Promise<TaskAnalysis> {
    await this.ensureInitialized();

    // Use AI for deep analysis if available
    if (this.zai) {
      try {
        return await this.aiTaskAnalysis(taskDescription);
      } catch {
        // Fall back to rule-based analysis
      }
    }

    return this.ruleBasedTaskAnalysis(taskDescription);
  }

  /**
   * Get skill recommendations with embeddings
   */
  async getEmbeddingRecommendations(
    taskEmbedding: number[],
    skills: ClawHubSkill[],
    topK: number = 10
  ): Promise<SkillRecommendation[]> {
    const recommendations: SkillRecommendation[] = [];

    for (const skill of skills) {
      const skillEmbedding = await this.getOrComputeEmbedding(skill);
      const similarity = this.embeddingsEngine.cosineSimilarity(taskEmbedding, skillEmbedding);

      if (similarity > 0.3) { // Minimum threshold
        recommendations.push({
          skill,
          relevanceScore: similarity,
          matchReasons: [`Semantic similarity: ${(similarity * 100).toFixed(1)}%`],
          capabilityMatches: [],
        });
      }
    }

    // Sort by relevance and return top K
    return recommendations
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);
  }

  // ============================================================================
  // AI-Powered Analysis
  // ============================================================================

  private async aiTaskAnalysis(taskDescription: string): Promise<TaskAnalysis> {
    const completion = await this.zai!.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Analyze the task description and return a JSON object with:
{
  "type": "one of: question, command, request, problem, clarification",
  "domain": "primary domain: coding, writing, analysis, research, automation, communication, design, testing, deployment, documentation, general",
  "requiredCapabilities": ["array of capabilities needed"],
  "keywords": ["array of 3-7 relevant keywords for skill search"],
  "complexity": "simple, moderate, or complex",
  "suggestedCategories": ["array of skill categories to search"],
  "confidence": 0.0-1.0 confidence in analysis
}

Return ONLY the JSON object.`,
        },
        {
          role: 'user',
          content: taskDescription,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content || '{}';
    const analysis = JSON.parse(response) as TaskAnalysis;
    
    // Ensure all fields are present
    return {
      type: analysis.type || 'request',
      domain: analysis.domain || 'general',
      requiredCapabilities: analysis.requiredCapabilities || [],
      keywords: analysis.keywords || [],
      complexity: analysis.complexity || 'moderate',
      suggestedCategories: analysis.suggestedCategories || [],
      confidence: analysis.confidence || 0.5,
    };
  }

  private ruleBasedTaskAnalysis(taskDescription: string): TaskAnalysis {
    const lower = taskDescription.toLowerCase();
    const keywords: string[] = [];
    const requiredCapabilities: string[] = [];
    const suggestedCategories: string[] = [];

    // Detect domain
    let domain = 'general';
    let maxMatches = 0;
    for (const [d, kws] of Object.entries(this.domainKeywords)) {
      const matches = kws.filter(kw => lower.includes(kw)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        domain = d;
      }
    }

    // Extract keywords
    const words = lower.split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = [...new Set(words)].slice(0, 7);
    keywords.push(...uniqueWords);

    // Detect required capabilities
    for (const [cap, patterns] of Object.entries(this.capabilityPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(taskDescription)) {
          requiredCapabilities.push(cap);
          break;
        }
      }
    }

    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (taskDescription.length > 200 || requiredCapabilities.length > 2) {
      complexity = 'moderate';
    }
    if (taskDescription.length > 500 || requiredCapabilities.length > 4) {
      complexity = 'complex';
    }

    // Suggest categories based on domain
    const categoryMap: Record<string, string[]> = {
      coding: ['coding', 'development', 'debugging'],
      writing: ['content', 'writing', 'marketing'],
      analysis: ['analytics', 'data', 'research'],
      research: ['research', 'web-search', 'information'],
      automation: ['automation', 'workflow', 'productivity'],
      communication: ['communication', 'email', 'messaging'],
      design: ['design', 'ui', 'frontend'],
      testing: ['testing', 'qa', 'quality'],
      deployment: ['devops', 'deployment', 'infrastructure'],
      documentation: ['documentation', 'writing', 'content'],
    };

    suggestedCategories.push(...(categoryMap[domain] || ['general']));

    return {
      type: lower.includes('?') ? 'question' : 'request',
      domain,
      requiredCapabilities: [...new Set(requiredCapabilities)],
      keywords: [...new Set(keywords)],
      complexity,
      suggestedCategories: [...new Set(suggestedCategories)],
      confidence: 0.6,
    };
  }

  // ============================================================================
  // Search and Ranking
  // ============================================================================

  private buildSearchQueries(analysis: TaskAnalysis, context: SuggestionContext): string[] {
    const queries: string[] = [];

    // Add keyword-based queries
    if (analysis.keywords.length > 0) {
      queries.push(analysis.keywords.slice(0, 3).join(' '));
    }

    // Add capability-based queries
    for (const cap of analysis.requiredCapabilities.slice(0, 3)) {
      queries.push(cap.replace(/_/g, ' '));
    }

    // Add category queries
    for (const cat of analysis.suggestedCategories.slice(0, 2)) {
      queries.push(cat);
    }

    // Add context from conversation history
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentHistory = context.conversationHistory.slice(-3).join(' ');
      const historyKeywords = this.extractKeywords(recentHistory);
      if (historyKeywords.length > 0) {
        queries.push(historyKeywords.slice(0, 2).join(' '));
      }
    }

    return [...new Set(queries)];
  }

  private async searchCandidates(
    queries: string[],
    context: SuggestionContext
  ): Promise<ClawHubSkill[]> {
    const candidates = new Map<string, ClawHubSkill>();

    for (const query of queries) {
      try {
        const result = await this.clawhub.search(query, {
          limit: context.maxSuggestions ? context.maxSuggestions * 2 : 20,
          minRating: context.userPreferences?.minRating,
        });

        for (const skill of result.skills) {
          candidates.set(skill.id, skill);
        }
      } catch (error) {
        // Continue with other queries even if one fails
        console.warn(`Search query failed: ${query}`, error);
      }
    }

    return Array.from(candidates.values());
  }

  private async rankCandidates(
    candidates: ClawHubSkill[],
    taskDescription: string,
    analysis: TaskAnalysis,
    context: SuggestionContext
  ): Promise<SkillRecommendation[]> {
    const recommendations: SkillRecommendation[] = [];

    // Compute task embedding
    const taskEmbedding = await this.embeddingsEngine.embed(taskDescription);

    for (const skill of candidates) {
      const recommendation = await this.computeRecommendation(
        skill,
        taskEmbedding,
        taskDescription,
        analysis,
        context
      );
      
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Sort by relevance score
    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private async computeRecommendation(
    skill: ClawHubSkill,
    taskEmbedding: number[],
    taskDescription: string,
    analysis: TaskAnalysis,
    context: SuggestionContext
  ): Promise<SkillRecommendation | null> {
    let relevanceScore = 0;
    const matchReasons: string[] = [];
    const capabilityMatches: string[] = [];

    // 1. Semantic similarity (40% weight)
    const skillEmbedding = await this.getOrComputeEmbedding(skill);
    const semanticSimilarity = this.embeddingsEngine.cosineSimilarity(taskEmbedding, skillEmbedding);
    relevanceScore += semanticSimilarity * 0.4;
    
    if (semanticSimilarity > 0.5) {
      matchReasons.push(`Strong semantic match (${(semanticSimilarity * 100).toFixed(0)}%)`);
    }

    // 2. Keyword matching (25% weight)
    const keywordMatch = this.computeKeywordMatch(
      taskDescription.toLowerCase(),
      skill.name.toLowerCase() + ' ' + skill.description.toLowerCase()
    );
    relevanceScore += keywordMatch * 0.25;
    
    if (keywordMatch > 0.3) {
      matchReasons.push(`Keywords match (${(keywordMatch * 100).toFixed(0)}%)`);
    }

    // 3. Capability matching (20% weight)
    const capMatch = this.computeCapabilityMatch(analysis.requiredCapabilities, skill);
    relevanceScore += capMatch * 0.2;
    
    for (const cap of analysis.requiredCapabilities) {
      const capLower = cap.replace(/_/g, ' ');
      if (skill.tags.some(t => t.toLowerCase().includes(capLower))) {
        capabilityMatches.push(cap);
      }
    }

    // 4. Rating and popularity (10% weight)
    const ratingScore = skill.rating / 5;
    const popularityScore = Math.min(1, skill.downloads / 1000);
    relevanceScore += (ratingScore + popularityScore) / 2 * 0.1;

    // 5. User preferences (5% weight)
    if (context.userPreferences) {
      const prefScore = this.computePreferenceScore(skill, context.userPreferences);
      relevanceScore += prefScore * 0.05;
    }

    // 6. Boost for installed skills if prioritized
    if (context.userPreferences?.prioritizeInstalled && 
        context.installedSkills?.includes(skill.name)) {
      relevanceScore += 0.1;
      matchReasons.push('Already installed');
    }

    // Generate suggested use case if AI available
    let suggestedUseCase: string | undefined;
    if (this.zai && relevanceScore > 0.5) {
      suggestedUseCase = await this.generateUseCase(skill, taskDescription);
    }

    return {
      skill,
      relevanceScore,
      matchReasons,
      capabilityMatches,
      suggestedUseCase,
    };
  }

  private computeKeywordMatch(text: string, skillText: string): number {
    const textWords = new Set(text.split(/\s+/).filter(w => w.length > 3));
    const skillWords = new Set(skillText.split(/\s+/).filter(w => w.length > 3));
    
    let matchCount = 0;
    for (const word of textWords) {
      if (skillWords.has(word)) {
        matchCount++;
      }
    }
    
    return textWords.size > 0 ? matchCount / textWords.size : 0;
  }

  private computeCapabilityMatch(capabilities: string[], skill: ClawHubSkill): number {
    if (capabilities.length === 0) return 0;
    
    const skillText = (skill.name + ' ' + skill.description + ' ' + skill.tags.join(' ')).toLowerCase();
    let matchCount = 0;
    
    for (const cap of capabilities) {
      const capLower = cap.replace(/_/g, ' ');
      if (skillText.includes(capLower)) {
        matchCount++;
      }
    }
    
    return matchCount / capabilities.length;
  }

  private computePreferenceScore(skill: ClawHubSkill, prefs: UserPreferences): number {
    let score = 0;
    
    // Preferred categories
    if (prefs.preferredCategories?.some(c => 
      skill.category === c || skill.tags.includes(c)
    )) {
      score += 0.5;
    }
    
    // Preferred authors
    if (prefs.preferredAuthors?.includes(skill.author)) {
      score += 0.3;
    }
    
    // Minimum rating check
    if (prefs.minRating && skill.rating < prefs.minRating) {
      score -= 0.5;
    }
    
    // Excluded tags
    if (prefs.excludeTags?.some(t => skill.tags.includes(t))) {
      score -= 0.3;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private applyFilters(
    recommendations: SkillRecommendation[],
    context: SuggestionContext
  ): SkillRecommendation[] {
    let filtered = recommendations;

    // Apply minimum relevance threshold
    const minScore = context.minRelevanceScore ?? 0.3;
    filtered = filtered.filter(r => r.relevanceScore >= minScore);

    // Apply limit
    const limit = context.maxSuggestions ?? 10;
    filtered = filtered.slice(0, limit);

    return filtered;
  }

  // ============================================================================
  // Embedding Management
  // ============================================================================

  private async getOrComputeEmbedding(skill: ClawHubSkill): Promise<number[]> {
    // Check cache
    const cached = this.skillEmbeddings.get(skill.id);
    if (cached && Date.now() - cached.lastUpdated < 86400000) { // 24 hours
      return cached.embedding;
    }

    // Compute new embedding
    const text = `${skill.name} ${skill.description} ${skill.tags.join(' ')}`;
    const embedding = await this.embeddingsEngine.embed(text);

    // Cache it
    this.skillEmbeddings.set(skill.id, {
      skillId: skill.id,
      embedding,
      lastUpdated: Date.now(),
    });

    // Persist cache
    this.saveEmbeddingCache();

    return embedding;
  }

  private async loadCachedEmbeddings(): Promise<void> {
    const cacheFile = join(this.cachePath, 'embeddings.json');
    if (!existsSync(cacheFile)) return;

    try {
      const content = readFileSync(cacheFile, 'utf-8');
      const entries = JSON.parse(content) as SkillEmbedding[];
      
      for (const entry of entries) {
        this.skillEmbeddings.set(entry.skillId, entry);
      }
    } catch {
      // Ignore cache errors
    }
  }

  private saveEmbeddingCache(): void {
    const cacheFile = join(this.cachePath, 'embeddings.json');
    const entries = Array.from(this.skillEmbeddings.values());
    
    try {
      writeFileSync(cacheFile, JSON.stringify(entries), 'utf-8');
    } catch {
      // Ignore cache errors
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
      'although', 'though', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself',
      'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
      'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
      'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom']);

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Count frequencies
    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    // Return top keywords by frequency
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private async generateUseCase(skill: ClawHubSkill, taskDescription: string): Promise<string> {
    if (!this.zai) return '';

    try {
      const completion = await this.zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Generate a brief (1-2 sentences) suggestion for how this skill could help with the given task. Be specific.',
          },
          {
            role: 'user',
            content: `Task: ${taskDescription}\nSkill: ${skill.name} - ${skill.description}`,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim() || '';
    } catch {
      return '';
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Pre-compute embeddings for multiple skills
   */
  async precomputeEmbeddings(skills: ClawHubSkill[]): Promise<void> {
    await this.ensureInitialized();
    
    const batchSize = 10;
    for (let i = 0; i < skills.length; i += batchSize) {
      const batch = skills.slice(i, i + batchSize);
      await Promise.all(batch.map(skill => this.getOrComputeEmbedding(skill)));
    }
    
    this.saveEmbeddingCache();
  }

  /**
   * Clear embedding cache
   */
  clearEmbeddingCache(): void {
    this.skillEmbeddings.clear();
    this.saveEmbeddingCache();
  }

  /**
   * Get embedding cache stats
   */
  getEmbeddingCacheStats(): { size: number; oldestEntry: number | null } {
    let oldest: number | null = null;
    
    for (const entry of this.skillEmbeddings.values()) {
      if (oldest === null || entry.lastUpdated < oldest) {
        oldest = entry.lastUpdated;
      }
    }
    
    return {
      size: this.skillEmbeddings.size,
      oldestEntry: oldest,
    };
  }
}

export default SkillSuggester;
