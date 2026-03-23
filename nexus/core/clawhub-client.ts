/**
 * NEXUS ClawHub Client - Skill Discovery and Installation
 * 
 * Provides a complete API client for ClawHub skill marketplace with:
 * - Skill search with filters
 * - Skill download and installation
 * - Response caching (1 hour TTL)
 * - Rate limit handling
 * - Offline mode support with cached skills
 * - Skill validation before installation
 * 
 * API Endpoint: https://api.clawhub.io/v1
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import ZAI from 'z-ai-web-dev-sdk';

// ============================================================================
// Types
// ============================================================================

export interface ClawHubSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  downloads: number;
  rating: number;
  skillMdUrl: string;
  readmeUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
  compatibility?: string[];
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  category?: string;
  tags?: string[];
  author?: string;
  sortBy?: 'downloads' | 'rating' | 'recent' | 'name';
  sortOrder?: 'asc' | 'desc';
  minRating?: number;
  minDownloads?: number;
}

export interface SkillSearchResult {
  skills: ClawHubSkill[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  query: string;
  filters: SearchOptions;
}

export interface InstallOptions {
  overwrite?: boolean;
  validateBeforeInstall?: boolean;
  targetPath?: string;
  onProgress?: (progress: InstallProgress) => void;
}

export interface InstallProgress {
  stage: 'downloading' | 'validating' | 'installing' | 'complete' | 'error';
  message: string;
  percentage: number;
}

export interface SkillValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    hasRequiredFields: boolean;
    hasPrompt: boolean;
    hasValidTags: boolean;
    estimatedTokens: number;
  };
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
}

export interface ClawHubConfig {
  apiEndpoint: string;
  cachePath: string;
  skillsPath: string;
  cacheTTL: number; // milliseconds
  requestTimeout: number;
  maxRetries: number;
  retryDelay: number;
  offlineMode: boolean;
}

export interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  skillCount: number;
  icon?: string;
}

// ============================================================================
// Error Classes
// ============================================================================

export class ClawHubError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ClawHubError';
  }
}

export class RateLimitError extends ClawHubError {
  constructor(
    public retryAfter: number,
    public limit: number
  ) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      429
    );
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends ClawHubError {
  constructor(message: string, public originalError?: Error) {
    super('NETWORK_ERROR', message);
    this.name = 'NetworkError';
  }
}

export class SkillNotFoundError extends ClawHubError {
  constructor(skillId: string) {
    super('SKILL_NOT_FOUND', `Skill '${skillId}' not found`, 404);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillValidationError extends ClawHubError {
  constructor(errors: string[]) {
    super('SKILL_VALIDATION_FAILED', `Skill validation failed: ${errors.join(', ')}`);
    this.name = 'SkillValidationError';
  }
}

// ============================================================================
// ClawHub Client Implementation
// ============================================================================

export class ClawHubClient {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private config: ClawHubConfig;
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private initialized: boolean = false;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private rateLimitRemaining: number = 100;
  private rateLimitReset: number = 0;
  
  // Rate limiting: 100 requests per minute
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
  private readonly RATE_LIMIT_MAX = 100;
  
  // Default configuration
  private static readonly DEFAULT_CONFIG: Partial<ClawHubConfig> = {
    apiEndpoint: 'https://api.clawhub.io/v1',
    cacheTTL: 3600000, // 1 hour
    requestTimeout: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000,
    offlineMode: false,
  };

  constructor(config: Partial<ClawHubConfig> = {}) {
    this.config = {
      ...ClawHubClient.DEFAULT_CONFIG,
      ...config,
    } as ClawHubConfig;
    
    // Set default paths
    if (!this.config.cachePath) {
      this.config.cachePath = join(process.cwd(), '.nexus', 'cache', 'clawhub');
    }
    if (!this.config.skillsPath) {
      this.config.skillsPath = join(process.cwd(), '.nexus', 'skills');
    }
  }

  /**
   * Initialize the ClawHub client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.zai = await ZAI.create();
    } catch (error) {
      console.warn('ClawHub: Failed to initialize AI SDK, some features may be limited');
    }

    // Ensure cache directory exists
    this.ensureDirectory(this.config.cachePath);
    this.ensureDirectory(this.config.skillsPath);

    // Load any persisted rate limit state
    this.loadRateLimitState();

    this.initialized = true;
  }

  // ============================================================================
  // Search Methods
  // ============================================================================

  /**
   * Search for skills matching a query
   */
  async search(query: string, options: SearchOptions = {}): Promise<SkillSearchResult> {
    await this.ensureInitialized();
    
    const cacheKey = this.getCacheKey('search', { query, ...options });
    const cached = await this.getFromCache<SkillSearchResult>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Check if offline mode or network unavailable
    if (this.config.offlineMode || !(await this.isNetworkAvailable())) {
      return this.offlineSearch(query, options);
    }

    try {
      const result = await this.makeRequest<SkillSearchResult>('/skills/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit: options.limit || 20,
          offset: options.offset || 0,
          category: options.category,
          tags: options.tags,
          author: options.author,
          sort_by: options.sortBy || 'downloads',
          sort_order: options.sortOrder || 'desc',
          min_rating: options.minRating,
          min_downloads: options.minDownloads,
        }),
      });

      await this.setToCache(cacheKey, result);
      return result;
    } catch (error) {
      // Fallback to offline search on network error
      if (error instanceof NetworkError) {
        return this.offlineSearch(query, options);
      }
      throw error;
    }
  }

  /**
   * Get a specific skill by ID
   */
  async getSkill(skillId: string): Promise<ClawHubSkill> {
    await this.ensureInitialized();

    const cacheKey = this.getCacheKey('skill', { skillId });
    const cached = await this.getFromCache<ClawHubSkill>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (this.config.offlineMode || !(await this.isNetworkAvailable())) {
      const offlineSkill = await this.getOfflineSkill(skillId);
      if (offlineSkill) return offlineSkill;
      throw new SkillNotFoundError(skillId);
    }

    try {
      const skill = await this.makeRequest<ClawHubSkill>(`/skills/${encodeURIComponent(skillId)}`);
      await this.setToCache(cacheKey, skill);
      return skill;
    } catch (error) {
      if ((error as ClawHubError).statusCode === 404) {
        throw new SkillNotFoundError(skillId);
      }
      throw error;
    }
  }

  /**
   * List all available categories
   */
  async listCategories(): Promise<CategoryInfo[]> {
    await this.ensureInitialized();

    const cacheKey = this.getCacheKey('categories');
    const cached = await this.getFromCache<CategoryInfo[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (this.config.offlineMode || !(await this.isNetworkAvailable())) {
      return this.getOfflineCategories();
    }

    const categories = await this.makeRequest<CategoryInfo[]>('/categories');
    await this.setToCache(cacheKey, categories);
    return categories;
  }

  /**
   * Get trending skills
   */
  async getTrending(limit: number = 10): Promise<ClawHubSkill[]> {
    await this.ensureInitialized();

    const cacheKey = this.getCacheKey('trending', { limit });
    const cached = await this.getFromCache<ClawHubSkill[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (this.config.offlineMode || !(await this.isNetworkAvailable())) {
      return this.getOfflineTrending(limit);
    }

    const skills = await this.makeRequest<ClawHubSkill[]>('/skills/trending', {
      query: { limit: limit.toString() },
    });
    
    await this.setToCache(cacheKey, skills);
    return skills;
  }

  /**
   * Get featured skills
   */
  async getFeatured(): Promise<ClawHubSkill[]> {
    await this.ensureInitialized();

    const cacheKey = this.getCacheKey('featured');
    const cached = await this.getFromCache<ClawHubSkill[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (this.config.offlineMode || !(await this.isNetworkAvailable())) {
      return this.getOfflineFeatured();
    }

    const skills = await this.makeRequest<ClawHubSkill[]>('/skills/featured');
    await this.setToCache(cacheKey, skills);
    return skills;
  }

  /**
   * Search skills by tag
   */
  async searchByTag(tag: string, options: SearchOptions = {}): Promise<SkillSearchResult> {
    return this.search('', { ...options, tags: [tag] });
  }

  /**
   * Search skills by author
   */
  async searchByAuthor(author: string, options: SearchOptions = {}): Promise<SkillSearchResult> {
    return this.search('', { ...options, author });
  }

  // ============================================================================
  // Download and Installation
  // ============================================================================

  /**
   * Download skill content
   */
  async downloadSkill(skillId: string): Promise<string> {
    await this.ensureInitialized();

    // First get the skill metadata to get the download URL
    const skill = await this.getSkill(skillId);
    
    if (!skill.skillMdUrl) {
      throw new ClawHubError('NO_DOWNLOAD_URL', `Skill '${skillId}' has no download URL`);
    }

    // Check cache first
    const cacheKey = this.getCacheKey('content', { skillId });
    const cached = await this.getFromCache<string>(cacheKey);
    if (cached) return cached;

    if (this.config.offlineMode || !(await this.isNetworkAvailable())) {
      const offlineContent = await this.getOfflineSkillContent(skillId);
      if (offlineContent) return offlineContent;
      throw new NetworkError(`Cannot download skill '${skillId}' in offline mode`);
    }

    try {
      const response = await this.makeRawRequest(skill.skillMdUrl);
      const content = await response.text();
      
      // Cache the content
      await this.setToCache(cacheKey, content);
      
      return content;
    } catch (error) {
      throw new NetworkError(`Failed to download skill '${skillId}'`, error as Error);
    }
  }

  /**
   * Validate skill content
   */
  async validateSkill(content: string): Promise<SkillValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields in frontmatter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontMatter: Record<string, string> = {};
    
    if (frontMatterMatch) {
      const fmContent = frontMatterMatch[1];
      for (const line of fmContent.split('\n')) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
          frontMatter[match[1]] = match[2];
        }
      }
    }

    // Required fields check
    if (!frontMatter.name) {
      errors.push('Missing required field: name');
    }
    if (!frontMatter.description) {
      errors.push('Missing required field: description');
    }
    if (!frontMatter.version) {
      warnings.push('Missing recommended field: version');
    }

    // Check for content after frontmatter
    const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    const body = bodyMatch ? bodyMatch[1].trim() : content;
    
    if (body.length < 50) {
      warnings.push('Skill content is very short (less than 50 characters)');
    }

    // Check for prompt/instructions section
    const hasPrompt = /##\s*(Instructions|Prompt|Purpose)/i.test(body);
    if (!hasPrompt) {
      warnings.push('Skill lacks clear instructions section');
    }

    // Validate tags
    let hasValidTags = false;
    if (frontMatter.tags) {
      try {
        const tagsMatch = frontMatter.tags.match(/\[([^\]]+)\]/);
        if (tagsMatch) {
          hasValidTags = true;
        }
      } catch {
        warnings.push('Invalid tags format');
      }
    }

    // Estimate tokens (rough approximation)
    const estimatedTokens = Math.ceil(content.length / 4);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        hasRequiredFields: !!frontMatter.name && !!frontMatter.description,
        hasPrompt: hasPrompt || body.includes('##'),
        hasValidTags,
        estimatedTokens,
      },
    };
  }

  /**
   * Install a skill from ClawHub
   */
  async installSkill(
    skillId: string,
    targetPath?: string,
    options: InstallOptions = {}
  ): Promise<{ path: string; skill: ClawHubSkill }> {
    await this.ensureInitialized();

    const { onProgress, validateBeforeInstall = true, overwrite = false } = options;
    const installPath = targetPath || this.config.skillsPath;

    // Report progress
    onProgress?.({
      stage: 'downloading',
      message: `Downloading skill '${skillId}'...`,
      percentage: 10,
    });

    // Get skill metadata
    const skill = await this.getSkill(skillId);
    
    // Download skill content
    const content = await this.downloadSkill(skillId);

    onProgress?.({
      stage: 'validating',
      message: 'Validating skill content...',
      percentage: 40,
    });

    // Validate if requested
    if (validateBeforeInstall) {
      const validation = await this.validateSkill(content);
      if (!validation.valid) {
        onProgress?.({
          stage: 'error',
          message: `Validation failed: ${validation.errors.join(', ')}`,
          percentage: 0,
        });
        throw new SkillValidationError(validation.errors);
      }
      
      if (validation.warnings.length > 0) {
        console.warn('Skill validation warnings:', validation.warnings);
      }
    }

    onProgress?.({
      stage: 'installing',
      message: 'Installing skill...',
      percentage: 70,
    });

    // Determine file path
    const fileName = this.sanitizeFileName(skill.name) + '.skill.md';
    const filePath = join(installPath, fileName);

    // Check if already installed
    if (existsSync(filePath) && !overwrite) {
      throw new ClawHubError(
        'SKILL_ALREADY_INSTALLED',
        `Skill '${skill.name}' is already installed at ${filePath}. Use overwrite: true to replace.`,
        409
      );
    }

    // Ensure target directory exists
    this.ensureDirectory(installPath);

    // Write skill file
    writeFileSync(filePath, content, 'utf-8');

    // Cache the installed skill
    await this.setToCache(this.getCacheKey('installed', { skillId }), {
      skill,
      installedAt: new Date().toISOString(),
      path: filePath,
    });

    onProgress?.({
      stage: 'complete',
      message: `Skill '${skill.name}' installed successfully!`,
      percentage: 100,
    });

    return { path: filePath, skill };
  }

  /**
   * Uninstall a skill
   */
  async uninstallSkill(skillName: string): Promise<boolean> {
    await this.ensureInitialized();

    const fileName = this.sanitizeFileName(skillName) + '.skill.md';
    const filePath = join(this.config.skillsPath, fileName);

    if (!existsSync(filePath)) {
      return false;
    }

    try {
      unlinkSync(filePath);
      
      // Remove from cache
      this.memoryCache.delete(this.getCacheKey('installed', { skillId: skillName }));
      
      return true;
    } catch (error) {
      throw new ClawHubError(
        'UNINSTALL_FAILED',
        `Failed to uninstall skill '${skillName}'`,
        undefined,
        { error }
      );
    }
  }

  /**
   * List installed skills
   */
  async listInstalled(): Promise<Array<{ name: string; path: string; installedAt?: Date }>> {
    await this.ensureInitialized();

    const skillsPath = this.config.skillsPath;
    if (!existsSync(skillsPath)) {
      return [];
    }

    const files = readdirSync(skillsPath);
    const installed: Array<{ name: string; path: string; installedAt?: Date }> = [];

    for (const file of files) {
      if (file.endsWith('.skill.md')) {
        const filePath = join(skillsPath, file);
        const name = file.replace('.skill.md', '');
        
        // Try to get install date from cache
        const cacheKey = this.getCacheKey('installed', { skillId: name });
        const cached = await this.getFromCache<{ installedAt: string }>(cacheKey);
        
        installed.push({
          name,
          path: filePath,
          installedAt: cached?.installedAt ? new Date(cached.installedAt) : undefined,
        });
      }
    }

    return installed;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    
    // Clear file cache
    if (existsSync(this.config.cachePath)) {
      const files = readdirSync(this.config.cachePath);
      for (const file of files) {
        try {
          unlinkSync(join(this.config.cachePath, file));
        } catch {
          // Ignore errors
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryCacheSize: number;
    fileCacheSize: number;
    totalEntries: number;
  } {
    let fileCacheSize = 0;
    
    if (existsSync(this.config.cachePath)) {
      const files = readdirSync(this.config.cachePath);
      fileCacheSize = files.length;
    }

    return {
      memoryCacheSize: this.memoryCache.size,
      fileCacheSize,
      totalEntries: this.memoryCache.size + fileCacheSize,
    };
  }

  // ============================================================================
  // Offline Support
  // ============================================================================

  /**
   * Enable offline mode
   */
  setOfflineMode(enabled: boolean): void {
    this.config.offlineMode = enabled;
  }

  /**
   * Check if offline mode is enabled
   */
  isOfflineMode(): boolean {
    return this.config.offlineMode;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async isNetworkAvailable(): Promise<boolean> {
    try {
      // Quick check to see if we can reach the API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch(`${this.config.apiEndpoint}/health`, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      query?: Record<string, string>;
    } = {}
  ): Promise<T> {
    await this.checkRateLimit();

    const url = new URL(endpoint, this.config.apiEndpoint);
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await this.makeRawRequest(url.toString(), {
      method: options.method || 'GET',
      body: options.body,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Update rate limit info from headers
    this.updateRateLimitFromHeaders(response.headers);

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  }

  private async makeRawRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.requestTimeout
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        
        this.requestCount++;
        this.lastRequestTime = Date.now();
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on abort
        if ((error as Error).name === 'AbortError') {
          throw new NetworkError('Request timed out', error as Error);
        }
        
        // Wait before retrying
        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    throw new NetworkError(
      `Request failed after ${this.config.maxRetries} attempts`,
      lastError || undefined
    );
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: Record<string, unknown> = {};
    
    try {
      errorBody = await response.json() as Record<string, unknown>;
    } catch {
      // Ignore JSON parsing errors
    }

    switch (response.status) {
      case 429: {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        throw new RateLimitError(retryAfter, this.RATE_LIMIT_MAX);
      }
      case 404:
        throw new ClawHubError('NOT_FOUND', errorBody.message as string || 'Resource not found', 404);
      case 401:
      case 403:
        throw new ClawHubError('UNAUTHORIZED', 'Unauthorized access', response.status);
      default:
        throw new ClawHubError(
          'API_ERROR',
          (errorBody.message as string) || `API error: ${response.status}`,
          response.status,
          errorBody
        );
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastRequestTime > this.RATE_LIMIT_WINDOW) {
      this.requestCount = 0;
      this.rateLimitRemaining = this.RATE_LIMIT_MAX;
    }
    
    // Check if we've hit the limit
    if (this.requestCount >= this.RATE_LIMIT_MAX) {
      const waitTime = this.RATE_LIMIT_WINDOW - (now - this.lastRequestTime);
      
      if (waitTime > 0) {
        throw new RateLimitError(Math.ceil(waitTime / 1000), this.RATE_LIMIT_MAX);
      }
    }
  }

  private updateRateLimitFromHeaders(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');
    
    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitReset = parseInt(reset, 10);
    }
  }

  private loadRateLimitState(): void {
    // Could load from file for persistence across restarts
    // For now, just reset
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  private getCacheKey(prefix: string, params: Record<string, unknown> = {}): string {
    const content = JSON.stringify({ prefix, ...params });
    return createHash('md5').update(content).digest('hex');
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryCached = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memoryCached && Date.now() - memoryCached.timestamp < memoryCached.ttl) {
      return memoryCached.data;
    }

    // Check file cache
    const filePath = join(this.config.cachePath, `${key}.json`);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const cached = JSON.parse(content) as CacheEntry<T>;
        
        if (Date.now() - cached.timestamp < cached.ttl) {
          // Promote to memory cache
          this.memoryCache.set(key, cached);
          return cached.data;
        }
        
        // Cache expired, remove file
        unlinkSync(filePath);
      } catch {
        // Invalid cache entry, remove it
        try {
          unlinkSync(filePath);
        } catch {
          // Ignore
        }
      }
    }

    return null;
  }

  private async setToCache<T>(key: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL,
    };

    // Set in memory cache
    this.memoryCache.set(key, entry);

    // Persist to file cache
    const filePath = join(this.config.cachePath, `${key}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    } catch {
      // Ignore file write errors
    }
  }

  // Offline fallback methods
  private async offlineSearch(query: string, options: SearchOptions): Promise<SkillSearchResult> {
    const installed = await this.listInstalled();
    const queryLower = query.toLowerCase();
    
    // Search through installed skills
    const matchingSkills: ClawHubSkill[] = [];
    
    for (const skill of installed) {
      if (queryLower && !skill.name.toLowerCase().includes(queryLower)) {
        continue;
      }
      
      // Try to read skill file for more metadata
      try {
        const content = readFileSync(skill.path, 'utf-8');
        const parsed = this.parseSkillFile(content);
        
        matchingSkills.push({
          id: skill.name,
          name: skill.name,
          description: parsed.description || 'Installed skill',
          author: parsed.author || 'Unknown',
          version: parsed.version || '1.0.0',
          tags: parsed.tags || [],
          downloads: 0,
          rating: 0,
          skillMdUrl: `file://${skill.path}`,
        });
      } catch {
        matchingSkills.push({
          id: skill.name,
          name: skill.name,
          description: 'Installed skill',
          author: 'Unknown',
          version: '1.0.0',
          tags: [],
          downloads: 0,
          rating: 0,
          skillMdUrl: `file://${skill.path}`,
        });
      }
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    const paginated = matchingSkills.slice(offset, offset + limit);

    return {
      skills: paginated,
      total: matchingSkills.length,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + limit < matchingSkills.length,
      query,
      filters: options,
    };
  }

  private async getOfflineSkill(skillId: string): Promise<ClawHubSkill | null> {
    const installed = await this.listInstalled();
    const skill = installed.find(s => s.name === skillId);
    
    if (!skill) return null;
    
    try {
      const content = readFileSync(skill.path, 'utf-8');
      const parsed = this.parseSkillFile(content);
      
      return {
        id: skill.name,
        name: skill.name,
        description: parsed.description || 'Installed skill',
        author: parsed.author || 'Unknown',
        version: parsed.version || '1.0.0',
        tags: parsed.tags || [],
        downloads: 0,
        rating: 0,
        skillMdUrl: `file://${skill.path}`,
      };
    } catch {
      return null;
    }
  }

  private async getOfflineSkillContent(skillId: string): Promise<string | null> {
    const fileName = this.sanitizeFileName(skillId) + '.skill.md';
    const filePath = join(this.config.skillsPath, fileName);
    
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8');
    }
    
    return null;
  }

  private async getOfflineCategories(): Promise<CategoryInfo[]> {
    // Return default categories for offline mode
    return [
      { id: 'general', name: 'General', description: 'General purpose skills', skillCount: 0 },
      { id: 'coding', name: 'Coding', description: 'Programming and development', skillCount: 0 },
      { id: 'analysis', name: 'Analysis', description: 'Data and text analysis', skillCount: 0 },
      { id: 'automation', name: 'Automation', description: 'Workflow automation', skillCount: 0 },
      { id: 'research', name: 'Research', description: 'Information gathering and research', skillCount: 0 },
    ];
  }

  private async getOfflineTrending(limit: number): Promise<ClawHubSkill[]> {
    const installed = await this.listInstalled();
    return installed.slice(0, limit).map(skill => ({
      id: skill.name,
      name: skill.name,
      description: 'Installed skill',
      author: 'Unknown',
      version: '1.0.0',
      tags: [],
      downloads: 0,
      rating: 0,
      skillMdUrl: `file://${skill.path}`,
    }));
  }

  private async getOfflineFeatured(): Promise<ClawHubSkill[]> {
    return this.getOfflineTrending(5);
  }

  private parseSkillFile(content: string): { 
    description?: string; 
    author?: string; 
    version?: string; 
    tags?: string[] 
  } {
    const result: { 
      description?: string; 
      author?: string; 
      version?: string; 
      tags?: string[] 
    } = {};
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (frontMatterMatch) {
      const fmContent = frontMatterMatch[1];
      for (const line of fmContent.split('\n')) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          let value: unknown = match[2].trim();
          
          // Parse arrays
          if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
          }
          
          // Parse quoted strings
          if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          
          // Assign to result with proper type checking
          if (key === 'description' && typeof value === 'string') {
            result.description = value;
          } else if (key === 'author' && typeof value === 'string') {
            result.author = value;
          } else if (key === 'version' && typeof value === 'string') {
            result.version = value;
          } else if (key === 'tags' && Array.isArray(value)) {
            result.tags = value as string[];
          }
        }
      }
    }
    
    return result;
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 100);
  }

  private ensureDirectory(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // AI-Enhanced Methods (using z-ai-web-dev-sdk)
  // ============================================================================

  /**
   * Get AI-generated skill recommendations based on context
   */
  async getRecommendations(context: string, limit: number = 5): Promise<ClawHubSkill[]> {
    await this.ensureInitialized();

    if (!this.zai) {
      // Fallback to trending if AI not available
      return this.getTrending(limit);
    }

    try {
      // Use AI to understand the context and extract relevant keywords
      const completion = await this.zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Extract 3-5 keywords for skill search from the given context. Return only the keywords as a JSON array of strings.',
          },
          {
            role: 'user',
            content: context,
          },
        ],
        max_tokens: 100,
        temperature: 0.3,
      });

      const keywords = JSON.parse(completion.choices[0]?.message?.content || '[]');
      
      if (Array.isArray(keywords) && keywords.length > 0) {
        // Search with extracted keywords
        const results = await this.search(keywords.join(' '), { limit });
        return results.skills;
      }
    } catch {
      // Fall through to trending
    }

    return this.getTrending(limit);
  }
}

export default ClawHubClient;
