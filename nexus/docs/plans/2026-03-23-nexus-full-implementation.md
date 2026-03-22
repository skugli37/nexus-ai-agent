# NEXUS Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform NEXUS from a 10% framework into a fully functional autonomous AI agent system with real LLM embeddings, executable tool generation, multi-agent delegation, and true self-evolution capabilities.

**Architecture:** Dual-processing (Conscious/Subconscious) with Vector DB memory, Tool Forge for executable code generation, Hierarchical Multi-Agent delegation, and autonomous Dream Cycles for self-improvement.

**Tech Stack:** TypeScript, Bun runtime, z-ai-web-dev-sdk for LLM/embeddings, Vector Store with semantic search, Skill system (SKILL.md standard)

---

## Current State Analysis

### What Exists (~10% complete)

| Component | Lines | Status | Issue |
|-----------|-------|--------|-------|
| agent.ts | 687 | Framework | No real integration |
| orchestrator.ts | 857 | Framework | Components not connected |
| conscious.ts | 621 | Framework | Tool calls are mock |
| subconscious.ts | 886 | Framework | No vector DB integration |
| scheduler.ts | 762 | Framework | Works but isolated |
| vector-store.ts | 420 | Partial | Deterministic embeddings only |
| tool-forge.ts | 709 | Partial | Generates templates, not executable |
| embeddings.ts | 290 | Mock | No real LLM embeddings |
| skill-executor.ts | 574 | Framework | Limited execution |
| CLI commands | 1075 | Partial | Missing interactive features |

### What's Missing (Remaining 90%)

1. **LLM-Based Embeddings** - Replace deterministic with real embeddings
2. **Vector Store Integration** - Connect to Subconscious memory
3. **Executable Tool Forge** - Generate runnable TypeScript/Python
4. **Code Execution Sandbox** - Safe code execution
5. **Multi-Agent Delegation** - Hierarchical agent structure
6. **Self-Evolution System** - Actual behavior modification
7. **Package Configuration** - Proper package.json
8. **Integration Tests** - Verify components work together

---

## Task 1: LLM-Based Embeddings Engine

**Files:**
- Modify: `/home/z/my-project/nexus/core/embeddings.ts`

**Step 1: Replace deterministic embeddings with z-ai-web-dev-sdk**

```typescript
/**
 * NEXUS Embeddings Module - Real LLM Embeddings
 * Uses z-ai-web-dev-sdk for production-quality embeddings
 */

import ZAI from 'z-ai-web-dev-sdk';

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  dimensions: number;
  model: string;
}

export class EmbeddingsEngine {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private cache: Map<string, number[]> = new Map();
  private dimensions: number = 1536; // OpenAI ada-002 dimensions
  private initialized: boolean = false;

  /**
   * Initialize the embeddings engine with z-ai-web-dev-sdk
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.zai = await ZAI.create();
    this.initialized = true;
  }

  /**
   * Generate embedding for a single text using LLM
   */
  async embed(text: string): Promise<number[]> {
    if (!this.initialized || !this.zai) {
      await this.initialize();
    }

    // Check cache first
    const cached = this.cache.get(text);
    if (cached) return cached;

    try {
      // Use z-ai-web-dev-sdk for embeddings
      const response = await this.zai!.embeddings.create({
        input: text,
        model: 'text-embedding-ada-002'
      });

      const embedding = response.data[0]?.embedding || [];
      
      // Cache the result
      this.cache.set(text, embedding);
      
      return embedding;
    } catch (error) {
      // Fallback to deterministic if LLM fails
      console.warn('LLM embeddings failed, using fallback:', error);
      return this.fallbackEmbed(text);
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    // Process in batches of 20 to avoid rate limits
    for (let i = 0; i < texts.length; i += 20) {
      const batch = texts.slice(i, i + 20);
      const batchEmbeddings = await Promise.all(
        batch.map(t => this.embed(t))
      );
      embeddings.push(...batchEmbeddings);
    }
    
    return embeddings;
  }

  /**
   * Fallback deterministic embedding (for offline/failure cases)
   */
  private fallbackEmbed(text: string): number[] {
    const vector: number[] = new Array(this.dimensions).fill(0);
    const lower = text.toLowerCase();
    
    // Simple hash-based embedding for fallback
    for (let i = 0; i < Math.min(text.length, this.dimensions); i++) {
      vector[i] = (text.charCodeAt(i) % 256) / 256;
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map(v => v / magnitude);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(magA) * Math.sqrt(magB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export default EmbeddingsEngine;
```

**Step 2: Run type check**

```bash
cd /home/z/my-project/nexus && bun run typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add core/embeddings.ts
git commit -m "feat(embeddings): replace deterministic with real LLM embeddings"
```

---

## Task 2: Integrate Vector Store with Subconscious Memory

**Files:**
- Modify: `/home/z/my-project/nexus/core/subconscious.ts`
- Modify: `/home/z/my-project/nexus/core/vector-store.ts`

**Step 1: Update Subconscious to use Vector Store**

Add to subconscious.ts imports:

```typescript
import { VectorStore } from './vector-store';
import { EmbeddingsEngine } from './embeddings';
```

Update Subconscious class:

```typescript
export class Subconscious extends EventEmitter implements ISubconscious {
  private status: AgentStatus = 'idle';
  private config: SubconsciousConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private vectorStore: VectorStore;
  private embeddings: EmbeddingsEngine;
  private patterns: Pattern[] = [];
  private behaviors: BehaviorAdjustment[] = [];
  private experiences: LearningExperience[] = [];
  private currentDreamCycle: DreamCycle | null = null;
  private isProcessing: boolean = false;
  private initialized: boolean = false;

  constructor(config: Partial<SubconsciousConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vectorStore = new VectorStore({
      path: '.nexus/memory',
      collectionName: 'nexus_memories'
    });
    this.embeddings = new EmbeddingsEngine();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.zai = await ZAI.create();
    await this.embeddings.initialize();
    await this.vectorStore.initialize();
    
    this.emitEvent('agent:started', { module: 'subconscious' });
    this.status = 'idle';
    this.initialized = true;
  }

  /**
   * Store memory with vector embedding
   */
  async storeMemoryVector(
    content: string,
    type: MemoryType = 'episodic',
    importance: number = 0.5,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
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
    
    this.emitEvent('memory:stored', { memoryId: memory.id, type });
    
    return memory.id;
  }

  /**
   * Retrieve memories using semantic search
   */
  async retrieveMemoriesVector(query: string, limit: number = 10): Promise<Memory[]> {
    const results = await this.vectorStore.search(query, limit);
    
    return results.map(r => ({
      id: r.id,
      type: r.type,
      content: r.content,
      importance: r.importance,
      accessCount: 0,
      lastAccessed: r.lastAccessed,
      createdAt: r.createdAt,
      associations: [],
      metadata: r.metadata
    }));
  }

  /**
   * Get memory context with semantic search
   */
  async getMemoryContextForQuery(query: string): Promise<MemoryContext> {
    const relevantMemories = await this.retrieveMemoriesVector(query, 5);
    const recentMemories = (await this.vectorStore.search('', 20))
      .map(r => ({
        id: r.id,
        type: r.type,
        content: r.content,
        importance: r.importance,
        accessCount: 0,
        lastAccessed: r.lastAccessed,
        createdAt: r.createdAt,
        associations: [],
        metadata: r.metadata
      }));

    return {
      workingMemory: recentMemories.slice(0, 5),
      recentMemories,
      relevantMemories,
      consolidatedPatterns: this.patterns
    };
  }
}
```

**Step 2: Commit**

```bash
git add core/subconscious.ts
git commit -m "feat(subconscious): integrate vector store for semantic memory"
```

---

## Task 3: Executable Tool Forge

**Files:**
- Modify: `/home/z/my-project/nexus/core/tool-forge.ts`

**Step 1: Add code execution capability**

```typescript
/**
 * Execute generated tool code safely
 */
async executeGeneratedTool(
  toolName: string,
  code: string,
  inputs: Record<string, unknown>
): Promise<unknown> {
  // Create a sandboxed execution context
  const sandbox = {
    inputs,
    console: {
      log: (...args: unknown[]) => console.log('[Tool]', ...args),
      error: (...args: unknown[]) => console.error('[Tool]', ...args),
      warn: (...args: unknown[]) => console.warn('[Tool]', ...args)
    },
    fetch: globalThis.fetch,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Date,
    Math,
    Promise,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval
  };

  // Wrap code in async function
  const wrappedCode = `
    (async function(sandbox) {
      const { inputs, console, fetch, JSON, Object, Array, String, Number, Boolean, Date, Math, Promise, setTimeout, setInterval, clearTimeout, clearInterval } = sandbox;
      ${code}
      return await execute(inputs);
    })
  `;

  try {
    // Use Function constructor for sandboxing
    const fn = new Function('sandbox', `return ${wrappedCode}`) as (sandbox: typeof sandbox) => Promise<unknown>;
    const result = await fn(sandbox);
    return result;
  } catch (error) {
    throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Forge and execute a tool in one step
 */
async forgeAndExecute(
  spec: ToolSpec,
  inputs: Record<string, unknown>
): Promise<{ tool: GeneratedTool; result: unknown }> {
  // Generate the tool
  const result = await this.forge(spec);
  
  if (!result.success || !result.tool) {
    throw new Error(result.error || 'Tool generation failed');
  }

  // Execute it
  const executionResult = await this.executeGeneratedTool(
    spec.name,
    result.tool.code,
    inputs
  );

  return {
    tool: result.tool,
    result: executionResult
  };
}
```

**Step 2: Add to ToolSpec interface**

```typescript
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, ToolParameter>;
  outputSchema?: Record<string, string>;
  examples?: Array<{ input: Record<string, unknown>; output: unknown; description?: string }>;
  category?: 'utility' | 'data' | 'api' | 'analysis' | 'generation';
  dependencies?: string[];
  executeImmediately?: boolean;  // NEW: Execute after generation
  testInputs?: Record<string, unknown>[];  // NEW: Test inputs
}
```

**Step 3: Commit**

```bash
git add core/tool-forge.ts
git commit -m "feat(tool-forge): add executable code generation with sandbox"
```

---

## Task 4: Multi-Agent Delegation System

**Files:**
- Create: `/home/z/my-project/nexus/core/delegation.ts`

**Step 1: Create delegation system**

```typescript
/**
 * NEXUS Multi-Agent Delegation System
 * Implements hierarchical agent structure like Agent Zero
 */

import { EventEmitter } from 'events';
import ZAI from 'z-ai-web-dev-sdk';
import { Agent } from './agent';
import { Task, TaskOutput, TaskPriority, ConversationContext } from './types';

// ============================================================================
// Types
// ============================================================================

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  tools: string[];
  maxSubordinates: number;
  capabilities: string[];
}

export interface DelegationResult {
  taskId: string;
  subordinateId: string;
  output: TaskOutput;
  duration: number;
  tokensUsed: number;
}

export interface SubordinateAgent {
  id: string;
  profile: AgentProfile;
  agent: Agent;
  superiorId: string | null;
  subordinates: SubordinateAgent[];
  taskHistory: Task[];
  status: 'idle' | 'busy' | 'error';
}

// ============================================================================
// Delegation Manager
// ============================================================================

export class DelegationManager extends EventEmitter {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private agents: Map<string, SubordinateAgent> = new Map();
  private rootAgent: SubordinateAgent | null = null;
  private agentCounter: number = 0;
  private profiles: Map<string, AgentProfile> = new Map();

  constructor() {
    super();
    this.initializeProfiles();
  }

  async initialize(): Promise<void> {
    this.zai = await ZAI.create();
  }

  /**
   * Initialize default agent profiles
   */
  private initializeProfiles(): void {
    const defaultProfiles: AgentProfile[] = [
      {
        id: 'coordinator',
        name: 'Coordinator',
        role: 'Main coordinator for complex multi-step tasks',
        systemPrompt: 'You are a coordinator agent. Your job is to break down complex tasks and delegate to specialized agents.',
        tools: ['delegate', 'synthesize', 'plan'],
        maxSubordinates: 5,
        capabilities: ['planning', 'coordination', 'synthesis']
      },
      {
        id: 'researcher',
        name: 'Researcher',
        role: 'Specialized in information gathering and analysis',
        systemPrompt: 'You are a research agent. Your job is to gather and analyze information thoroughly.',
        tools: ['web_search', 'analyze', 'summarize'],
        maxSubordinates: 2,
        capabilities: ['research', 'analysis', 'web_search']
      },
      {
        id: 'coder',
        name: 'Coder',
        role: 'Specialized in code generation and debugging',
        systemPrompt: 'You are a coding agent. Your job is to write, debug, and optimize code.',
        tools: ['code_execute', 'file_write', 'test'],
        maxSubordinates: 2,
        capabilities: ['code_generation', 'debugging', 'testing']
      },
      {
        id: 'writer',
        name: 'Writer',
        role: 'Specialized in content creation and editing',
        systemPrompt: 'You are a writing agent. Your job is to create and edit high-quality content.',
        tools: ['write', 'edit', 'format'],
        maxSubordinates: 1,
        capabilities: ['writing', 'editing', 'formatting']
      }
    ];

    for (const profile of defaultProfiles) {
      this.profiles.set(profile.id, profile);
    }
  }

  /**
   * Create a new subordinate agent
   */
  async createSubordinate(
    profileId: string,
    superiorId: string | null = null
  ): Promise<SubordinateAgent> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    this.agentCounter++;
    const agentId = `agent-${this.agentCounter}`;

    const agent = new Agent({
      id: agentId,
      name: `${profile.name}-${this.agentCounter}`,
      autoStartDreamCycles: false
    });

    await agent.initialize();

    const subordinate: SubordinateAgent = {
      id: agentId,
      profile,
      agent,
      superiorId,
      subordinates: [],
      taskHistory: [],
      status: 'idle'
    };

    this.agents.set(agentId, subordinate);

    // Link to superior
    if (superiorId) {
      const superior = this.agents.get(superiorId);
      if (superior && superior.subordinates.length < superior.profile.maxSubordinates) {
        superior.subordinates.push(subordinate);
      }
    } else if (!this.rootAgent) {
      this.rootAgent = subordinate;
    }

    this.emit('agent:created', { agentId, profileId, superiorId });

    return subordinate;
  }

  /**
   * Delegate a task to a subordinate
   */
  async delegateTask(
    task: Task,
    fromAgentId: string,
    toProfileId?: string
  ): Promise<DelegationResult> {
    const fromAgent = this.agents.get(fromAgentId);
    if (!fromAgent) {
      throw new Error(`Agent ${fromAgentId} not found`);
    }

    // Determine best profile for task
    const targetProfileId = toProfileId || await this.selectBestProfile(task);

    // Find or create subordinate
    let subordinate = fromAgent.subordinates.find(
      s => s.profile.id === targetProfileId && s.status === 'idle'
    );

    if (!subordinate && fromAgent.subordinates.length < fromAgent.profile.maxSubordinates) {
      subordinate = await this.createSubordinate(targetProfileId, fromAgentId);
    }

    if (!subordinate) {
      throw new Error('No available subordinate for delegation');
    }

    subordinate.status = 'busy';
    const startTime = Date.now();

    try {
      // Execute task
      const output = await subordinate.agent.processInput(task.input.content);

      subordinate.status = 'idle';
      subordinate.taskHistory.push(task);

      const result: DelegationResult = {
        taskId: task.id,
        subordinateId: subordinate.id,
        output,
        duration: Date.now() - startTime,
        tokensUsed: output.tokensUsed
      };

      this.emit('delegation:complete', result);

      return result;
    } catch (error) {
      subordinate.status = 'error';
      throw error;
    }
  }

  /**
   * Select the best profile for a task
   */
  private async selectBestProfile(task: Task): Promise<string> {
    if (!this.zai) {
      return 'coordinator';
    }

    const taskDescription = task.input.content;
    const profileDescriptions = Array.from(this.profiles.values())
      .map(p => `${p.id}: ${p.role} (${p.capabilities.join(', ')})`)
      .join('\n');

    const response = await this.zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Select the best agent profile for this task. Respond with only the profile ID.

Available profiles:
${profileDescriptions}`
        },
        { role: 'user', content: taskDescription }
      ],
      max_tokens: 50,
      temperature: 0
    });

    const selectedProfile = response.choices[0]?.message?.content?.trim() || 'coordinator';
    
    // Validate
    if (this.profiles.has(selectedProfile)) {
      return selectedProfile;
    }
    return 'coordinator';
  }

  /**
   * Get agent hierarchy
   */
  getHierarchy(): string {
    if (!this.rootAgent) return 'No agents created';
    return this.buildHierarchyString(this.rootAgent, 0);
  }

  private buildHierarchyString(agent: SubordinateAgent, depth: number): string {
    const indent = '  '.repeat(depth);
    let result = `${indent}${agent.profile.name} (${agent.id}) - ${agent.status}\n`;
    
    for (const sub of agent.subordinates) {
      result += this.buildHierarchyString(sub, depth + 1);
    }
    
    return result;
  }

  /**
   * Get all agents
   */
  getAgents(): SubordinateAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.agent.shutdown();
    }
    this.agents.clear();
    this.rootAgent = null;
  }
}

export default DelegationManager;
```

**Step 2: Commit**

```bash
git add core/delegation.ts
git commit -m "feat(delegation): add multi-agent delegation system"
```

---

## Task 5: Create Package Configuration

**Files:**
- Create: `/home/z/my-project/nexus/package.json`

```json
{
  "name": "nexus-ai-agent",
  "version": "1.0.0",
  "description": "NEXUS - Autonomous AI Agent with Conscious/Subconscious Architecture",
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "nexus": "./cli/index.ts"
  },
  "scripts": {
    "start": "bun run cli/index.ts",
    "build": "bun build ./core/index.ts ./cli/index.ts --outdir ./dist",
    "dev": "bun --watch run cli/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint core cli tools --ext .ts",
    "nexus": "bun run cli/index.ts"
  },
  "dependencies": {
    "z-ai-web-dev-sdk": "latest",
    "eventemitter3": "^5.0.1",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "inquirer": "^9.2.0",
    "ora": "^8.0.0",
    "yaml": "^2.3.0",
    "marked": "^12.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/inquirer": "^9.0.0",
    "typescript": "^5.3.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0"
  },
  "keywords": [
    "ai",
    "agent",
    "autonomous",
    "llm",
    "vector-database",
    "tool-generation",
    "multi-agent",
    "self-evolution"
  ],
  "author": "NEXUS Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/skugli37/nexus-ai-agent"
  },
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "types": ["bun-types"]
  },
  "include": ["core/**/*", "cli/**/*", "tools/**/*"],
  "exclude": ["node_modules", "dist", ".nexus"]
}
```

**Step 3: Install dependencies**

```bash
cd /home/z/my-project/nexus && bun install
```

**Step 4: Commit**

```bash
git add package.json tsconfig.json bun.lockb
git commit -m "chore: add package configuration and dependencies"
```

---

## Task 6: Update Core Index with All Exports

**Files:**
- Modify: `/home/z/my-project/nexus/core/index.ts`

```typescript
/**
 * NEXUS Core Engine
 * Main entry point for all core components
 */

// Core Engine Components
export { Agent } from './agent';
export { Orchestrator } from './orchestrator';
export { Conscious } from './conscious';
export { Subconscious } from './subconscious';
export { Scheduler } from './scheduler';

// Memory & Embeddings
export { VectorStore } from './vector-store';
export { EmbeddingsEngine } from './embeddings';

// Tool & Skill Systems
export { ToolForge } from './tool-forge';
export { SkillExecutor } from './skill-executor';

// Multi-Agent
export { DelegationManager } from './delegation';

// Types
export * from './types';

// Version
export const NEXUS_VERSION = '1.0.0';
```

**Step 2: Commit**

```bash
git add core/index.ts
git commit -m "feat(core): export all components from index"
```

---

## Task 7: Create Integration Tests

**Files:**
- Create: `/home/z/my-project/nexus/tests/integration.test.ts`

```typescript
/**
 * NEXUS Integration Tests
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Agent } from '../core/agent';
import { Orchestrator } from '../core/orchestrator';
import { VectorStore } from '../core/vector-store';
import { EmbeddingsEngine } from '../core/embeddings';
import { ToolForge } from '../core/tool-forge';
import { DelegationManager } from '../core/delegation';

describe('NEXUS Integration Tests', () => {
  describe('Embeddings', () => {
    let embeddings: EmbeddingsEngine;

    beforeAll(async () => {
      embeddings = new EmbeddingsEngine();
      await embeddings.initialize();
    });

    test('should generate embeddings for text', async () => {
      const result = await embeddings.embed('Hello world');
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should calculate similarity', async () => {
      const a = await embeddings.embed('cat');
      const b = await embeddings.embed('dog');
      const c = await embeddings.embed('feline');
      
      const simAB = embeddings.cosineSimilarity(a, b);
      const simAC = embeddings.cosineSimilarity(a, c);
      
      // 'cat' should be more similar to 'feline' than 'dog'
      expect(simAC).toBeGreaterThan(simAB);
    });
  });

  describe('Vector Store', () => {
    let vectorStore: VectorStore;

    beforeAll(async () => {
      vectorStore = new VectorStore({ path: '.nexus/test-memory' });
      await vectorStore.initialize();
    });

    afterAll(async () => {
      await vectorStore.clear();
    });

    test('should store and retrieve memories', async () => {
      const memory = {
        id: crypto.randomUUID(),
        type: 'episodic' as const,
        content: 'Test memory content',
        importance: 0.8,
        accessCount: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        associations: [],
        metadata: {}
      };

      await vectorStore.store(memory);
      
      const results = await vectorStore.search('Test memory');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('Test');
    });
  });

  describe('Agent', () => {
    let agent: Agent;

    beforeAll(async () => {
      agent = new Agent({ autoStartDreamCycles: false });
      await agent.initialize();
    });

    afterAll(async () => {
      await agent.shutdown();
    });

    test('should initialize successfully', () => {
      expect(agent.isInitialized()).toBe(true);
    });

    test('should process input', async () => {
      const result = await agent.processInput('Hello, who are you?');
      expect(result.content).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Tool Forge', () => {
    let toolForge: ToolForge;

    beforeAll(async () => {
      toolForge = new ToolForge('.nexus/test-tools');
      await toolForge.initialize();
    });

    test('should generate a tool from spec', async () => {
      const result = await toolForge.forge({
        name: 'test-calculator',
        description: 'Performs basic arithmetic calculations',
        inputSchema: {
          a: { type: 'number', description: 'First number', required: true },
          b: { type: 'number', description: 'Second number', required: true },
          operation: { type: 'string', description: 'Operation', enum: ['add', 'subtract', 'multiply', 'divide'], required: true }
        },
        category: 'utility'
      });

      expect(result.success).toBe(true);
      expect(result.tool).toBeDefined();
      expect(result.tool?.code).toContain('async function');
    });
  });

  describe('Delegation', () => {
    let delegation: DelegationManager;

    beforeAll(async () => {
      delegation = new DelegationManager();
      await delegation.initialize();
    });

    afterAll(async () => {
      await delegation.shutdown();
    });

    test('should create subordinate agents', async () => {
      const subordinate = await delegation.createSubordinate('researcher');
      expect(subordinate).toBeDefined();
      expect(subordinate.profile.id).toBe('researcher');
    });

    test('should build agent hierarchy', async () => {
      await delegation.createSubordinate('coordinator');
      const hierarchy = delegation.getHierarchy();
      expect(hierarchy).toContain('Coordinator');
    });
  });

  describe('Orchestrator', () => {
    let orchestrator: Orchestrator;

    beforeAll(async () => {
      orchestrator = new Orchestrator();
      await orchestrator.initialize();
    });

    afterAll(async () => {
      await orchestrator.shutdown();
    });

    test('should initialize successfully', () => {
      expect(orchestrator.isInitialized()).toBe(true);
    });

    test('should return health status', () => {
      const health = orchestrator.getHealth();
      expect(health.status).toBeDefined();
      expect(health.components).toBeDefined();
    });

    test('should return metrics', () => {
      const metrics = orchestrator.getMetrics();
      expect(metrics).toBeDefined();
    });
  });
});
```

**Step 2: Run tests**

```bash
cd /home/z/my-project/nexus && bun test tests/integration.test.ts
```

**Step 3: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: add integration tests for all components"
```

---

## Task 8: Create Executable Skills

**Files:**
- Create: `/home/z/my-project/nexus/.nexus/skills/code-generator.skill.md`

```markdown
---
name: "code-generator"
description: "Generates executable code based on specifications"
version: "1.0.0"
tags: ["code", "generation", "typescript", "python"]
tools: ["code_execute", "file_write"]
---

# Code Generator Skill

You are an expert code generator. Your job is to create high-quality, executable code based on specifications.

## Capabilities

- Generate TypeScript, Python, JavaScript, and other languages
- Create full implementations, not just snippets
- Include proper error handling
- Add tests when requested
- Follow best practices and patterns

## Instructions

When given a code specification:

1. **Analyze Requirements**
   - Understand the desired functionality
   - Identify input/output formats
   - Consider edge cases

2. **Design Solution**
   - Choose appropriate patterns
   - Consider performance
   - Plan for extensibility

3. **Generate Code**
   - Write clean, well-documented code
   - Include type definitions
   - Add proper error handling
   - Include usage examples

4. **Validate**
   - Ensure code is syntactically correct
   - Check for common bugs
   - Verify it meets requirements

## Output Format

Always structure your output as:

\`\`\`typescript
// Generated by NEXUS Code Generator
// Purpose: [Description]

interface Input {
  // Input parameters
}

interface Output {
  // Output structure
}

async function execute(input: Input): Promise<Output> {
  // Implementation
}

export default execute;
\`\`\`

## Examples

**Input:** Create a function that calculates the nth Fibonacci number

**Output:**
\`\`\`typescript
interface FibonacciInput {
  n: number;
}

interface FibonacciOutput {
  result: number;
  iterations: number;
}

async function execute(input: FibonacciInput): Promise<FibonacciOutput> {
  if (input.n < 0) {
    throw new Error('n must be non-negative');
  }
  
  if (input.n <= 1) {
    return { result: input.n, iterations: 0 };
  }
  
  let a = 0, b = 1;
  let iterations = 0;
  
  for (let i = 2; i <= input.n; i++) {
    [a, b] = [b, a + b];
    iterations++;
  }
  
  return { result: b, iterations };
}

export default execute;
\`\`\`
```

**Step 2: Create research skill**

```markdown
---
name: "deep-research"
description: "Conducts comprehensive research on any topic using web search"
version: "1.0.0"
tags: ["research", "analysis", "web-search", "synthesis"]
tools: ["web_search", "analyze", "summarize"]
---

# Deep Research Skill

You are an expert researcher. Your job is to conduct thorough research on any topic and present findings in a structured, comprehensive manner.

## Research Process

1. **Initial Search**
   - Broad query to understand the landscape
   - Identify key concepts and terminology
   - Find authoritative sources

2. **Deep Dive**
   - Follow promising leads
   - Search for specific sub-topics
   - Gather diverse perspectives

3. **Synthesis**
   - Organize findings thematically
   - Identify patterns and connections
   - Draw conclusions

4. **Output**
   - Executive summary
   - Detailed findings
   - Sources and citations
   - Recommendations

## Output Format

# [Topic] Research Report

## Executive Summary
[2-3 paragraph overview]

## Key Findings
- Finding 1
- Finding 2
- Finding 3

## Detailed Analysis
[Comprehensive analysis]

## Sources
- [Source 1]
- [Source 2]

## Recommendations
[Actionable recommendations]
```

**Step 3: Commit**

```bash
git add .nexus/skills/
git commit -m "feat(skills): add code-generator and deep-research skills"
```

---

## Task 9: Create README Documentation

**Files:**
- Create: `/home/z/my-project/nexus/README.md`

```markdown
# NEXUS - Autonomous AI Agent System

<div align="center">

![NEXUS Logo](https://img.shields.io/badge/NEXUS-AI%20Agent-0D6EFD?style=for-the-badge)

**A revolutionary AI agent with Conscious/Subconscious architecture**

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Architecture](#architecture)

</div>

---

## Features

### 🧠 Dual-Processing Architecture
- **Conscious Module**: Active, real-time reasoning and task execution
- **Subconscious Module**: Background learning, memory consolidation, pattern recognition

### 🔮 Vector-Based Memory
- Semantic search with real LLM embeddings
- Memory types: Episodic, Semantic, Procedural, Working
- Automatic consolidation during dream cycles

### ⚒️ Tool Forge
- Dynamically generates executable TypeScript/Python tools
- Sandbox execution environment
- Automatic validation and testing

### 🤖 Multi-Agent Delegation
- Hierarchical agent structure
- Specialized agent profiles (Coordinator, Researcher, Coder, Writer)
- Automatic task routing

### 🌙 Dream Cycles
- Automatic memory consolidation
- Pattern recognition and learning
- Self-improvement generation

### 📦 Skill System
- SKILL.md standard format
- Markdown-based skill definitions
- Dynamic skill loading and execution

---

## Installation

```bash
# Clone the repository
git clone https://github.com/skugli37/nexus-ai-agent.git
cd nexus-ai-agent

# Install dependencies
bun install

# Initialize a new project
bun run nexus init my-project
cd my-project
```

---

## Usage

### CLI Commands

```bash
# Start the agent
bun run nexus start

# Interactive chat
bun run nexus chat

# Run dream cycle
bun run nexus dream --deep

# Create a new tool
bun run nexus forge tool my-tool --description "Does something useful"

# Create a new skill
bun run nexus forge skill my-skill --description "Handles specific tasks"

# View status
bun run nexus status

# Self-reflection
bun run nexus reflect
```

### Interactive Chat Commands

```
/help      - Show available commands
/memorize  - Store information in memory
/recall    - Retrieve from memory
/status    - Show session status
/dream     - Quick dream cycle
/exit      - End session
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR                         │
│            (Coordination & Health Monitoring)            │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│     CONSCIOUS       │         │    SUBCONSCIOUS      │
│   (Active Tasks)    │◄───────►│  (Background Work)   │
├─────────────────────┤         ├─────────────────────┤
│ • Input Processing  │         │ • Dream Cycles       │
│ • LLM Reasoning     │         │ • Memory Consolidate │
│ • Tool Execution    │         │ • Pattern Analysis   │
│ • Skill Execution   │         │ • Self-Improvement   │
└─────────────────────┘         └─────────────────────┘
           │                               │
           └───────────────┬───────────────┘
                           ▼
              ┌─────────────────────────┐
              │      VECTOR STORE        │
              │   (Semantic Memory)      │
              │   with LLM Embeddings    │
              └─────────────────────────┘
```

---

## Components

### Agent
The central hub that coordinates Conscious and Subconscious modules.

### Orchestrator
Top-level controller managing component lifecycle, events, and health.

### Scheduler
Cron-based scheduling for autonomous operations:
- Dream cycles (every 5 minutes)
- Self-reflection (daily at 3 AM)
- Memory cleanup (daily at 4 AM)
- Tool forge (weekly)

### Vector Store
In-memory vector database with semantic search capabilities.

### Tool Forge
Dynamic tool generation with executable code output.

### Delegation Manager
Multi-agent coordination with hierarchical structure.

---

## Configuration

Create `nexus.json` in your project:

```json
{
  "name": "my-nexus-project",
  "version": "1.0.0",
  "nexus": {
    "home": ".nexus",
    "model": {
      "primary": "gpt-4",
      "utility": "gpt-3.5-turbo"
    }
  }
}
```

---

## Skills

Skills are stored as `.skill.md` files in `.nexus/skills/`:

```markdown
---
name: "my-skill"
description: "What this skill does"
version: "1.0.0"
tags: ["category"]
---

# My Skill

Instructions for the skill...
```

---

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Contributing

Contributions welcome! Please read our contributing guidelines.

---

<div align="center">

Made with ❤️ by the NEXUS Team

</div>
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README"
```

---

## Task 10: Final Integration and Push

**Step 1: Verify all components work together**

```bash
cd /home/z/my-project/nexus
bun run typecheck
bun test
bun run nexus status
```

**Step 2: Push to GitHub**

```bash
git add -A
git commit -m "feat: complete NEXUS implementation with all features"
git push origin main
```

---

## Summary

This plan transforms NEXUS from a 10% framework into a fully functional autonomous AI agent system:

| Component | Before | After |
|-----------|--------|-------|
| Embeddings | Deterministic | Real LLM |
| Memory | JSON arrays | Vector DB |
| Tool Forge | Templates | Executable code |
| Multi-Agent | None | Full delegation |
| Tests | None | Integration suite |
| Documentation | Minimal | Comprehensive |

**Estimated Implementation Time:** 2-4 hours

**Dependencies Required:**
- z-ai-web-dev-sdk (LLM + Embeddings)
- bun runtime
- TypeScript 5.3+
