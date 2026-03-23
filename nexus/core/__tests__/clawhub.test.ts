/**
 * NEXUS ClawHub Integration - Test Suite
 * 
 * Comprehensive tests for ClawHub API client and Skill Suggester
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, mock } from 'bun:test';
import {
  ClawHubClient,
  ClawHubError,
  RateLimitError,
  NetworkError,
  SkillNotFoundError,
  SkillValidationError,
  type ClawHubSkill,
  type SearchOptions,
  type SkillSearchResult,
  type InstallProgress,
} from '../clawhub-client';

import {
  SkillSuggester,
  type TaskAnalysis,
  type SkillRecommendation,
  type SuggestionContext,
  type SuggestionResult,
} from '../skill-suggester';

// ============================================================================
// TEST UTILITIES
// ============================================================================

const TEST_CACHE_PATH = '/tmp/nexus-test-cache/clawhub';
const TEST_SKILLS_PATH = '/tmp/nexus-test-skills';

// Mock skills for testing
const mockSkills: ClawHubSkill[] = [
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Helps with coding tasks, debugging, and code review',
    author: 'nexus-team',
    version: '1.0.0',
    tags: ['coding', 'debugging', 'review'],
    downloads: 1500,
    rating: 4.5,
    skillMdUrl: 'https://api.clawhub.io/v1/skills/code-assistant/download',
    category: 'coding',
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web for information and summarize results',
    author: 'nexus-team',
    version: '2.0.0',
    tags: ['search', 'web', 'research'],
    downloads: 5000,
    rating: 4.8,
    skillMdUrl: 'https://api.clawhub.io/v1/skills/web-search/download',
    category: 'research',
  },
  {
    id: 'data-analyzer',
    name: 'Data Analyzer',
    description: 'Analyze datasets and generate insights',
    author: 'data-team',
    version: '1.5.0',
    tags: ['data', 'analysis', 'visualization'],
    downloads: 800,
    rating: 4.2,
    skillMdUrl: 'https://api.clawhub.io/v1/skills/data-analyzer/download',
    category: 'analysis',
  },
  {
    id: 'document-writer',
    name: 'Document Writer',
    description: 'Create and edit documents, articles, and reports',
    author: 'content-team',
    version: '1.2.0',
    tags: ['writing', 'content', 'documentation'],
    downloads: 1200,
    rating: 4.0,
    skillMdUrl: 'https://api.clawhub.io/v1/skills/document-writer/download',
    category: 'writing',
  },
  {
    id: 'automation-agent',
    name: 'Automation Agent',
    description: 'Automate repetitive tasks and workflows',
    author: 'automation-team',
    version: '3.0.0',
    tags: ['automation', 'workflow', 'productivity'],
    downloads: 3000,
    rating: 4.6,
    skillMdUrl: 'https://api.clawhub.io/v1/skills/automation-agent/download',
    category: 'automation',
  },
];

// Valid skill content for testing
const validSkillContent = `---
name: "Test Skill"
description: "A test skill for unit testing"
version: "1.0.0"
author: "Test Author"
tags: ["test", "unit"]
---

# Test Skill

## Purpose

This is a test skill for unit testing the ClawHub client.

## Instructions

1. Step one
2. Step two
3. Step three

## Inputs

- query: The search query (string, required)

## Outputs

- result: The result of the operation
`;

// Invalid skill content for testing
const invalidSkillContent = `# Missing Frontmatter

This skill has no frontmatter.
`;

// ============================================================================
// CLAWHUB CLIENT TESTS
// ============================================================================

describe('ClawHubClient', () => {
  let client: ClawHubClient;

  beforeEach(() => {
    client = new ClawHubClient({
      cachePath: TEST_CACHE_PATH,
      skillsPath: TEST_SKILLS_PATH,
      offlineMode: true, // Start in offline mode for unit tests
    });
  });

  afterEach(async () => {
    try {
      await client.clearCache();
    } catch {
      // Ignore cleanup errors
    }
  });

  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================

  describe('Initialization', () => {
    test('should create ClawHubClient instance', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(ClawHubClient);
    });

    test('should initialize without errors', async () => {
      await expect(client.initialize()).resolves.not.toThrow();
    });

    test('should accept custom configuration', () => {
      const customClient = new ClawHubClient({
        apiEndpoint: 'https://custom.api.endpoint/v1',
        cacheTTL: 7200000,
        requestTimeout: 60000,
        maxRetries: 5,
        retryDelay: 2000,
        offlineMode: true,
      });

      expect(customClient).toBeDefined();
    });

    test('should use default configuration values', () => {
      const defaultClient = new ClawHubClient();
      expect(defaultClient).toBeDefined();
    });

    test('should not re-initialize if already initialized', async () => {
      await client.initialize();
      await expect(client.initialize()).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // OFFLINE MODE TESTS
  // ==========================================================================

  describe('Offline Mode', () => {
    beforeEach(async () => {
      await client.initialize();
      client.setOfflineMode(true);
    });

    test('should be in offline mode', () => {
      expect(client.isOfflineMode()).toBe(true);
    });

    test('should toggle offline mode', () => {
      client.setOfflineMode(false);
      expect(client.isOfflineMode()).toBe(false);
      
      client.setOfflineMode(true);
      expect(client.isOfflineMode()).toBe(true);
    });

    test('should search installed skills in offline mode', async () => {
      const result = await client.search('test');
      
      expect(result).toBeDefined();
      expect(result.skills).toBeDefined();
      expect(Array.isArray(result.skills)).toBe(true);
      expect(result.query).toBe('test');
      expect(typeof result.total).toBe('number');
    });

    test('should list categories in offline mode', async () => {
      const categories = await client.listCategories();
      
      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    test('should get trending skills in offline mode', async () => {
      const skills = await client.getTrending(5);
      
      expect(skills).toBeDefined();
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeLessThanOrEqual(5);
    });

    test('should get featured skills in offline mode', async () => {
      const skills = await client.getFeatured();
      
      expect(skills).toBeDefined();
      expect(Array.isArray(skills)).toBe(true);
    });

    test('should list installed skills', async () => {
      const installed = await client.listInstalled();
      
      expect(installed).toBeDefined();
      expect(Array.isArray(installed)).toBe(true);
    });

    test('should throw SkillNotFoundError for non-existent skill', async () => {
      await expect(client.getSkill('non-existent-skill')).rejects.toThrow(SkillNotFoundError);
    });
  });

  // ==========================================================================
  // SKILL VALIDATION TESTS
  // ==========================================================================

  describe('Skill Validation', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    test('should validate a correct skill file', async () => {
      const validation = await client.validateSkill(validSkillContent);
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('should detect missing required fields', async () => {
      const validation = await client.validateSkill(invalidSkillContent);
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.includes('name'))).toBe(true);
      expect(validation.errors.some(e => e.includes('description'))).toBe(true);
    });

    test('should warn about short content', async () => {
      const shortContent = `---
name: "Short"
description: "Short"
---
Short`;
      
      const validation = await client.validateSkill(shortContent);
      
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('short'))).toBe(true);
    });

    test('should include metadata in validation result', async () => {
      const validation = await client.validateSkill(validSkillContent);
      
      expect(validation.metadata).toBeDefined();
      expect(typeof validation.metadata.hasRequiredFields).toBe('boolean');
      expect(typeof validation.metadata.estimatedTokens).toBe('number');
    });

    test('should estimate tokens correctly', async () => {
      const validation = await client.validateSkill(validSkillContent);
      
      // Rough estimation: content length / 4
      const expectedEstimate = Math.ceil(validSkillContent.length / 4);
      expect(validation.metadata.estimatedTokens).toBeCloseTo(expectedEstimate, -1);
    });
  });

  // ==========================================================================
  // CACHE MANAGEMENT TESTS
  // ==========================================================================

  describe('Cache Management', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    test('should clear cache without errors', async () => {
      await expect(client.clearCache()).resolves.not.toThrow();
    });

    test('should provide cache statistics', () => {
      const stats = client.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.memoryCacheSize).toBe('number');
      expect(typeof stats.fileCacheSize).toBe('number');
      expect(typeof stats.totalEntries).toBe('number');
    });

    test('should cache search results', async () => {
      // First search (cache miss)
      const result1 = await client.search('test');
      
      // Second search (should use cache)
      const result2 = await client.search('test');
      
      expect(result1).toEqual(result2);
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('Error Handling', () => {
    test('ClawHubError should have correct properties', () => {
      const error = new ClawHubError('TEST_CODE', 'Test message', 400, { detail: 'test' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ClawHubError');
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ detail: 'test' });
    });

    test('RateLimitError should have correct properties', () => {
      const error = new RateLimitError(60, 100);
      
      expect(error).toBeInstanceOf(ClawHubError);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(60);
      expect(error.limit).toBe(100);
      expect(error.statusCode).toBe(429);
    });

    test('NetworkError should have correct properties', () => {
      const originalError = new Error('Connection refused');
      const error = new NetworkError('Network failed', originalError);
      
      expect(error).toBeInstanceOf(ClawHubError);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.originalError).toBe(originalError);
    });

    test('SkillNotFoundError should have correct properties', () => {
      const error = new SkillNotFoundError('test-skill');
      
      expect(error).toBeInstanceOf(ClawHubError);
      expect(error.code).toBe('SKILL_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('test-skill');
    });

    test('SkillValidationError should have correct properties', () => {
      const error = new SkillValidationError(['Missing name', 'Missing description']);
      
      expect(error).toBeInstanceOf(ClawHubError);
      expect(error.code).toBe('SKILL_VALIDATION_FAILED');
      expect(error.message).toContain('Missing name');
    });
  });

  // ==========================================================================
  // INSTALL PROGRESS TESTS
  // ==========================================================================

  describe('Installation', () => {
    beforeEach(async () => {
      await client.initialize();
      client.setOfflineMode(true);
    });

    test('should throw error when installing non-existent skill', async () => {
      const progressCalls: InstallProgress[] = [];
      
      await expect(
        client.installSkill('non-existent-skill', TEST_SKILLS_PATH, {
          onProgress: (p) => progressCalls.push(p),
        })
      ).rejects.toThrow();
    });
  });
});

// ============================================================================
// SKILL SUGGESTER TESTS
// ============================================================================

describe('SkillSuggester', () => {
  let suggester: SkillSuggester;
  let client: ClawHubClient;

  beforeEach(() => {
    client = new ClawHubClient({
      cachePath: TEST_CACHE_PATH,
      skillsPath: TEST_SKILLS_PATH,
      offlineMode: true,
    });
    suggester = new SkillSuggester(client, TEST_CACHE_PATH);
  });

  afterEach(async () => {
    try {
      await client.clearCache();
      suggester.clearEmbeddingCache();
    } catch {
      // Ignore cleanup errors
    }
  });

  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================

  describe('Initialization', () => {
    test('should create SkillSuggester instance', () => {
      expect(suggester).toBeDefined();
      expect(suggester).toBeInstanceOf(SkillSuggester);
    });

    test('should initialize without errors', async () => {
      await expect(suggester.initialize()).resolves.not.toThrow();
    });

    test('should not re-initialize if already initialized', async () => {
      await suggester.initialize();
      await expect(suggester.initialize()).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // TASK ANALYSIS TESTS
  // ==========================================================================

  describe('Task Analysis', () => {
    beforeEach(async () => {
      await suggester.initialize();
    });

    test('should analyze a coding task', async () => {
      const analysis = await suggester.analyzeTask('Write a function to sort an array');
      
      expect(analysis).toBeDefined();
      expect(analysis.domain).toBeDefined();
      expect(analysis.keywords.length).toBeGreaterThan(0);
      expect(analysis.complexity).toBeDefined();
      expect(['simple', 'moderate', 'complex']).toContain(analysis.complexity);
    });

    test('should analyze a research task', async () => {
      const analysis = await suggester.analyzeTask('Search the web for latest AI news and summarize');
      
      expect(analysis).toBeDefined();
      expect(analysis.domain).toBeDefined();
      expect(analysis.keywords.length).toBeGreaterThan(0);
    });

    test('should detect required capabilities', async () => {
      const analysis = await suggester.analyzeTask('Search for information about Python programming');
      
      expect(analysis.requiredCapabilities).toBeDefined();
      expect(Array.isArray(analysis.requiredCapabilities)).toBe(true);
    });

    test('should suggest categories based on task', async () => {
      const analysis = await suggester.analyzeTask('Analyze sales data and create visualizations');
      
      expect(analysis.suggestedCategories).toBeDefined();
      expect(Array.isArray(analysis.suggestedCategories)).toBe(true);
    });

    test('should return confidence score', async () => {
      const analysis = await suggester.analyzeTask('Write code');
      
      expect(analysis.confidence).toBeDefined();
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    test('should handle complex tasks', async () => {
      const complexTask = `
        I need to build a complete web application with:
        - Frontend in React
        - Backend API in Node.js
        - Database integration
        - Authentication system
        - CI/CD pipeline
      `;
      
      const analysis = await suggester.analyzeTask(complexTask);
      
      expect(analysis.complexity).toBe('complex');
    });
  });

  // ==========================================================================
  // SUGGESTION TESTS
  // ==========================================================================

  describe('Skill Suggestions', () => {
    beforeEach(async () => {
      await suggester.initialize();
    });

    test('should return suggestions for a task', async () => {
      const result = await suggester.suggest({
        taskDescription: 'Write Python code to process data',
        maxSuggestions: 5,
      });
      
      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.searchQueries).toBeDefined();
      expect(Array.isArray(result.searchQueries)).toBe(true);
      expect(typeof result.processingTime).toBe('number');
    });

    test('should respect maxSuggestions limit', async () => {
      const result = await suggester.suggest({
        taskDescription: 'Analyze data',
        maxSuggestions: 3,
      });
      
      expect(result.recommendations.length).toBeLessThanOrEqual(3);
    });

    test('should filter by minimum relevance score', async () => {
      const result = await suggester.suggest({
        taskDescription: 'Write code',
        minRelevanceScore: 0.5,
      });
      
      for (const rec of result.recommendations) {
        expect(rec.relevanceScore).toBeGreaterThanOrEqual(0.5);
      }
    });

    test('should include relevance score in recommendations', async () => {
      const result = await suggester.suggest({
        taskDescription: 'Search the web',
      });
      
      for (const rec of result.recommendations) {
        expect(rec.relevanceScore).toBeDefined();
        expect(rec.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(rec.relevanceScore).toBeLessThanOrEqual(1);
      }
    });

    test('should include match reasons', async () => {
      const result = await suggester.suggest({
        taskDescription: 'Write documentation',
      });
      
      for (const rec of result.recommendations) {
        expect(rec.matchReasons).toBeDefined();
        expect(Array.isArray(rec.matchReasons)).toBe(true);
      }
    });

    test('should provide quick suggestions', async () => {
      const recommendations = await suggester.quickSuggest('debug code', 5);
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });
  });

  // ==========================================================================
  // EMBEDDING CACHE TESTS
  // ==========================================================================

  describe('Embedding Cache', () => {
    beforeEach(async () => {
      await suggester.initialize();
    });

    test('should clear embedding cache', () => {
      expect(() => suggester.clearEmbeddingCache()).not.toThrow();
    });

    test('should provide cache statistics', async () => {
      const stats = suggester.getEmbeddingCacheStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.size).toBe('number');
    });

    test('should cache computed embeddings', async () => {
      const skill: ClawHubSkill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill for embedding cache',
        author: 'test',
        version: '1.0.0',
        tags: ['test'],
        downloads: 100,
        rating: 4.0,
        skillMdUrl: 'https://example.com/skill.md',
      };

      await suggester.precomputeEmbeddings([skill]);
      
      const stats = suggester.getEmbeddingCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // USER PREFERENCES TESTS
  // ==========================================================================

  describe('User Preferences', () => {
    beforeEach(async () => {
      await suggester.initialize();
    });

    test('should accept user preferences', async () => {
      const result = await suggester.suggest({
        taskDescription: 'Write code',
        userPreferences: {
          preferredCategories: ['coding'],
          minRating: 4.0,
        },
      });
      
      expect(result).toBeDefined();
    });

    test('should consider installed skills', async () => {
      const result = await suggester.suggest({
        taskDescription: 'Search web',
        installedSkills: ['web-search'],
        userPreferences: {
          prioritizeInstalled: true,
        },
      });
      
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // BATCH OPERATIONS TESTS
  // ==========================================================================

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await suggester.initialize();
    });

    test('should precompute embeddings for multiple skills', async () => {
      const skills: ClawHubSkill[] = [
        {
          id: 'skill-1',
          name: 'Skill 1',
          description: 'First skill',
          author: 'test',
          version: '1.0.0',
          tags: [],
          downloads: 100,
          rating: 4.0,
          skillMdUrl: 'https://example.com/skill1.md',
        },
        {
          id: 'skill-2',
          name: 'Skill 2',
          description: 'Second skill',
          author: 'test',
          version: '1.0.0',
          tags: [],
          downloads: 100,
          rating: 4.0,
          skillMdUrl: 'https://example.com/skill2.md',
        },
      ];

      await expect(suggester.precomputeEmbeddings(skills)).resolves.not.toThrow();
      
      const stats = suggester.getEmbeddingCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration: ClawHubClient + SkillSuggester', () => {
  let client: ClawHubClient;
  let suggester: SkillSuggester;

  beforeAll(async () => {
    client = new ClawHubClient({
      cachePath: TEST_CACHE_PATH,
      skillsPath: TEST_SKILLS_PATH,
      offlineMode: true,
    });
    suggester = new SkillSuggester(client, TEST_CACHE_PATH);
    
    await client.initialize();
    await suggester.initialize();
  });

  afterAll(async () => {
    try {
      await client.clearCache();
      suggester.clearEmbeddingCache();
    } catch {
      // Ignore
    }
  });

  test('should work together for skill discovery', async () => {
    // Get suggestions
    const suggestions = await suggester.suggest({
      taskDescription: 'I need to write Python code to analyze data',
      maxSuggestions: 5,
    });

    // Verify we have recommendations
    expect(suggestions.recommendations.length).toBeGreaterThanOrEqual(0);
    expect(suggestions.analysis.domain).toBeDefined();
  });

  test('should handle chained operations', async () => {
    // 1. Analyze task
    const analysis = await suggester.analyzeTask('Create a web application');

    // 2. Get suggestions
    const result = await suggester.suggest({
      taskDescription: 'Create a web application',
      maxSuggestions: 3,
    });

    // 3. Both should complete without errors
    expect(analysis).toBeDefined();
    expect(result).toBeDefined();
    expect(result.analysis).toBeDefined();
  });

  test('should maintain consistent results', async () => {
    const task = 'Debug JavaScript code';

    // Get suggestions twice
    const result1 = await suggester.quickSuggest(task, 3);
    const result2 = await suggester.quickSuggest(task, 3);

    // Should produce similar results (may vary slightly due to timing)
    expect(result1.length).toBe(result2.length);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Performance', () => {
  let client: ClawHubClient;
  let suggester: SkillSuggester;

  beforeAll(async () => {
    client = new ClawHubClient({
      cachePath: TEST_CACHE_PATH,
      skillsPath: TEST_SKILLS_PATH,
      offlineMode: true,
    });
    suggester = new SkillSuggester(client, TEST_CACHE_PATH);
    
    await client.initialize();
    await suggester.initialize();
  });

  test('should analyze task quickly', async () => {
    const start = Date.now();
    await suggester.analyzeTask('Write code to sort an array');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  test('should provide suggestions quickly', async () => {
    const start = Date.now();
    await suggester.quickSuggest('Test query', 5);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
  });

  test('should handle multiple requests efficiently', async () => {
    const tasks = [
      'Write Python code',
      'Search the web',
      'Analyze data',
      'Create documentation',
      'Debug code',
    ];

    const start = Date.now();
    await Promise.all(tasks.map(task => suggester.quickSuggest(task, 3)));
    const duration = Date.now() - start;

    // All 5 requests should complete in under 30 seconds
    expect(duration).toBeLessThan(30000);
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases', () => {
  let suggester: SkillSuggester;

  beforeEach(async () => {
    const client = new ClawHubClient({
      cachePath: TEST_CACHE_PATH,
      skillsPath: TEST_SKILLS_PATH,
      offlineMode: true,
    });
    suggester = new SkillSuggester(client, TEST_CACHE_PATH);
    await suggester.initialize();
  });

  test('should handle empty task description', async () => {
    const result = await suggester.suggest({
      taskDescription: '',
    });

    expect(result).toBeDefined();
    expect(result.recommendations).toBeDefined();
  });

  test('should handle very long task description', async () => {
    const longTask = 'Write code '.repeat(1000);
    
    const result = await suggester.suggest({
      taskDescription: longTask,
    });

    expect(result).toBeDefined();
  });

  test('should handle special characters in task', async () => {
    const specialTask = 'Write code @#$%^&*(){}[]|\\;:\'",.<>?/~`';
    
    const result = await suggester.suggest({
      taskDescription: specialTask,
    });

    expect(result).toBeDefined();
  });

  test('should handle unicode in task', async () => {
    const unicodeTask = '写代码 分析数据 🚀🎉';
    
    const result = await suggester.suggest({
      taskDescription: unicodeTask,
    });

    expect(result).toBeDefined();
  });

  test('should handle zero maxSuggestions', async () => {
    const result = await suggester.suggest({
      taskDescription: 'Test',
      maxSuggestions: 0,
    });

    expect(result.recommendations.length).toBe(0);
  });

  test('should handle high minRelevanceScore', async () => {
    const result = await suggester.suggest({
      taskDescription: 'Test',
      minRelevanceScore: 0.99,
    });

    // Most recommendations should be filtered out
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
  });
});
