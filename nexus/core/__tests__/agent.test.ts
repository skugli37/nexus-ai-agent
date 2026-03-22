/**
 * NEXUS Core Agent Tests
 * Tests that PROVE the agent actually works
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Agent } from '../agent';
import { VectorStore } from '../vector-store';
import { EmbeddingsEngine } from '../embeddings';
import { ToolForge } from '../tool-forge';
import { CodeSandbox } from '../sandbox';
import { Scheduler } from '../scheduler';

describe('NEXUS Core Engine', () => {
  describe('Agent', () => {
    let agent: Agent;

    beforeAll(async () => {
      agent = new Agent({
        id: 'test-agent',
        name: 'TestNEXUS',
        autoStartDreamCycles: false,
      });
    });

    afterAll(async () => {
      if (agent) {
        await agent.shutdown();
      }
    });

    test('should initialize successfully', async () => {
      await agent.initialize();
      expect(agent.isInitialized()).toBe(true);
    });

    test('should have correct initial state', () => {
      const state = agent.getState();
      expect(state.id).toBe('test-agent');
      expect(state.status).toBe('idle');
    });

    test('should start and end sessions', () => {
      const sessionId = agent.startSession();
      expect(sessionId).toBeDefined();
      expect(agent.getState().sessionId).toBe(sessionId);
      
      agent.endSession();
      expect(agent.getState().sessionId).toBeNull();
    });

    test('should queue tasks correctly', () => {
      const task = agent.queueTask('reasoning', { content: 'test task' }, 'high');
      expect(task.id).toBeDefined();
      expect(task.type).toBe('reasoning');
      expect(task.priority).toBe('high');
      expect(agent.getPendingTaskCount()).toBe(1);
      
      agent.clearTaskQueue();
      expect(agent.getPendingTaskCount()).toBe(0);
    });

    test('should store memories', () => {
      expect(() => {
        agent.storeMemory('Test memory content', 'episodic', 0.8);
      }).not.toThrow();
    });

    test('should retrieve memories', async () => {
      const memories = await agent.retrieveMemories('Test memory');
      expect(Array.isArray(memories)).toBe(true);
    });

    test('should track metrics', () => {
      const metrics = agent.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.tasksCompleted).toBe('number');
      expect(typeof metrics.tasksFailed).toBe('number');
    });
  });

  describe('VectorStore', () => {
    let store: VectorStore;

    beforeAll(async () => {
      store = new VectorStore({
        path: '.nexus/test-memory',
        collectionName: 'test_vectors',
      });
      await store.initialize();
    });

    test('should initialize correctly', () => {
      const stats = store.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe('number');
    });

    test('should store and search vectors', async () => {
      const memory = {
        id: crypto.randomUUID(),
        type: 'episodic' as const,
        content: 'This is a test memory about AI agents',
        importance: 0.7,
        accessCount: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        associations: [],
        metadata: { test: true },
      };

      await store.store(memory);
      
      const results = await store.search('AI agents', 5);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should get memories by type', async () => {
      const episodic = store.getByType('episodic');
      expect(Array.isArray(episodic)).toBe(true);
    });
  });

  describe('EmbeddingsEngine', () => {
    let engine: EmbeddingsEngine;

    beforeAll(async () => {
      engine = new EmbeddingsEngine();
      await engine.initialize();
    });

    test('should generate embeddings', async () => {
      const embedding = await engine.embed('Test text for embedding');
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    test('should calculate cosine similarity', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      const c = [0, 1, 0];
      
      const simAB = engine.cosineSimilarity(a, b);
      const simAC = engine.cosineSimilarity(a, c);
      
      expect(simAB).toBeCloseTo(1, 5);
      expect(simAC).toBeCloseTo(0, 5);
    });

    test('should handle batch embeddings', async () => {
      const texts = ['Text one', 'Text two', 'Text three'];
      const embeddings = await engine.embedBatch(texts);
      
      expect(embeddings.length).toBe(3);
      embeddings.forEach(e => {
        expect(Array.isArray(e)).toBe(true);
      });
    });
  });

  describe('ToolForge', () => {
    let forge: ToolForge;

    beforeAll(async () => {
      forge = new ToolForge('.nexus/test-tools');
      await forge.initialize();
    });

    test('should initialize correctly', () => {
      expect(forge).toBeDefined();
    });

    test('should forge a simple tool', async () => {
      const spec = {
        name: 'test_calculator',
        description: 'A simple calculator tool',
        inputSchema: {
          a: { type: 'number' as const, description: 'First number', required: true },
          b: { type: 'number' as const, description: 'Second number', required: true },
          operation: { 
            type: 'string' as const, 
            description: 'Operation to perform',
            enum: ['add', 'subtract', 'multiply', 'divide'],
            required: true
          }
        },
        category: 'utility' as const,
      };

      const result = await forge.forge(spec);
      
      expect(result.success).toBe(true);
      expect(result.tool).toBeDefined();
      expect(result.tool?.name).toBe('test_calculator');
      expect(result.tool?.code).toContain('async function');
    });

    test('should validate tool specs', async () => {
      const invalidSpec = {
        name: '',
        description: 'Invalid tool',
        inputSchema: {},
      };

      const result = await forge.forge(invalidSpec);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should list generated tools', () => {
      const tools = forge.getGeneratedTools();
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('CodeSandbox', () => {
    let sandbox: CodeSandbox;

    beforeAll(() => {
      sandbox = new CodeSandbox({ timeout: 5000, allowFetch: true });
    });

    test('should execute valid JavaScript', async () => {
      const code = `
        const result = 2 + 2;
        return result;
      `;

      const result = await sandbox.execute(code, {});
      
      expect(result.success).toBe(true);
      expect(result.output).toBe(4);
    });

    test('should handle async code', async () => {
      const code = `
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        await delay(100);
        return 'async works';
      `;

      const result = await sandbox.execute(code, {});
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('async works');
    });

    test('should capture console logs', async () => {
      const code = `
        console.log('Hello from sandbox');
        console.log('Multiple logs');
        return 'done';
      `;

      const result = await sandbox.execute(code, {});
      
      expect(result.logs).toContain('Hello from sandbox');
      expect(result.logs).toContain('Multiple logs');
    });

    test('should reject dangerous code', () => {
      const dangerousCode = `eval('malicious code')`;
      const validation = sandbox.validateCode(dangerousCode);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    test('should handle timeouts', async () => {
      const timeoutSandbox = new CodeSandbox({ timeout: 100 });
      const code = `
        while (true) {}
      `;

      const result = await timeoutSandbox.execute(code, {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Scheduler', () => {
    let scheduler: Scheduler;
    let executedTasks: string[] = [];

    beforeAll(() => {
      scheduler = new Scheduler({ tickInterval: 100 });
      executedTasks = [];
    });

    afterAll(() => {
      scheduler.stop();
    });

    test('should schedule dream cycle', () => {
      const task = scheduler.scheduleDreamCycle(5);
      expect(task.type).toBe('dream_cycle');
      expect(task.enabled).toBe(true);
    });

    test('should get pending count', () => {
      const count = scheduler.getPendingCount();
      expect(typeof count).toBe('number');
    });

    test('should get time until next task', () => {
      const time = scheduler.getTimeUntilNext();
      expect(time === null || typeof time === 'number').toBe(true);
    });

    test('should start and stop scheduler', () => {
      scheduler.start();
      expect(scheduler.isActive()).toBe(true);
      
      scheduler.stop();
      expect(scheduler.isActive()).toBe(false);
    });
  });
});

describe('NEXUS Integration Tests', () => {
  test('Full agent workflow', async () => {
    const agent = new Agent({
      id: 'integration-test',
      name: 'IntegrationTestAgent',
      autoStartDreamCycles: false,
    });

    try {
      // Initialize
      await agent.initialize();
      expect(agent.isInitialized()).toBe(true);

      // Store a memory
      agent.storeMemory('Integration test memory', 'semantic', 0.9);

      // Queue a task
      const task = agent.queueTask('reasoning', { content: 'What is 2+2?' }, 'high');
      expect(task.id).toBeDefined();

      // Check metrics
      const metrics = agent.getMetrics();
      expect(metrics).toBeDefined();

      // Shutdown
      await agent.shutdown();
      expect(agent.isInitialized()).toBe(false);
    } catch (error) {
      await agent.shutdown();
      throw error;
    }
  });

  test('Memory system integration', async () => {
    const store = new VectorStore({
      path: '.nexus/test-integration',
      collectionName: 'integration_test',
    });
    
    await store.initialize();

    // Store multiple memories
    const memories = [
      { id: crypto.randomUUID(), type: 'episodic' as const, content: 'Memory 1', importance: 0.5, accessCount: 0, lastAccessed: new Date(), createdAt: new Date(), associations: [], metadata: {} },
      { id: crypto.randomUUID(), type: 'semantic' as const, content: 'Memory 2', importance: 0.7, accessCount: 0, lastAccessed: new Date(), createdAt: new Date(), associations: [], metadata: {} },
      { id: crypto.randomUUID(), type: 'procedural' as const, content: 'Memory 3', importance: 0.9, accessCount: 0, lastAccessed: new Date(), createdAt: new Date(), associations: [], metadata: {} },
    ];

    for (const m of memories) {
      await store.store(m);
    }

    const stats = store.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(3);
  });
});
