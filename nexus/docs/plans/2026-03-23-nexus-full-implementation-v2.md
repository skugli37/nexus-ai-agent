# NEXUS Full Implementation Plan v2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete AI agent framework that combines the best of OpenClaw (Build Node system) and Agent Zero (Docker isolation, Web UI), with professional UI surpassing both.

**Architecture:** 
- Core Engine: Conscious/Subconscious architecture with vector memory
- Build Node: Pipeline-based skill execution like OpenClaw
- Web UI: Next.js 15 + React + Tailwind + shadcn/ui
- Docker: Multi-language sandbox execution
- CLI: Professional terminal interface

**Tech Stack:** 
- Backend: TypeScript, Bun, z-ai-web-dev-sdk
- Frontend: Next.js 15, React 19, Tailwind CSS 4, shadcn/ui
- Database: Prisma with SQLite/PostgreSQL
- Real-time: WebSocket
- Docker: Multi-container setup

---

## Phase 1: Build Node System (OpenClaw-style)

### Task 1.1: NodeExecutor Base Class

**Files:**
- Create: `core/build-node/executor.ts`
- Create: `core/build-node/__tests__/executor.test.ts`

**Step 1: Write the failing test**

```typescript
// core/build-node/__tests__/executor.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';
import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult } from '../types';

describe('NodeExecutor', () => {
  test('should create executor with correct type', () => {
    class SkillExecutor extends NodeExecutor<'skill'> {
      type = 'skill' as const;
      async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
        return { nodeId: node.id, success: true, outputs: {}, executionTime: 0, retryCount: 0 };
      }
      async validate(node: BuildNode): Promise<boolean> { return true; }
      getSchema() { return []; }
    }
    
    const executor = new SkillExecutor();
    expect(executor.type).toBe('skill');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/z/my-project/nexus && bun test core/build-node/__tests__/executor.test.ts`
Expected: FAIL - Cannot find module '../executor'

**Step 3: Write minimal implementation**

```typescript
// core/build-node/executor.ts
import { BuildNode, ExecutionContext, NodeExecutionResult, INodeExecutor, NodePort } from './types';

export abstract class NodeExecutor<T extends string = string> implements INodeExecutor {
  abstract type: T;
  abstract execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult>;
  abstract validate(node: BuildNode): Promise<boolean>;
  abstract getSchema(): NodePort[];
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add core/build-node/executor.ts core/build-node/__tests__/executor.test.ts
git commit -m "feat(build-node): add base NodeExecutor class"
```

---

### Task 1.2: SkillNodeExecutor

**Files:**
- Create: `core/build-node/executors/skill-executor.ts`
- Create: `core/build-node/__tests__/skill-executor.test.ts`

**Implementation:**

```typescript
// core/build-node/executors/skill-executor.ts
import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';
import ZAI from 'z-ai-web-dev-sdk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export class SkillNodeExecutor extends NodeExecutor<'skill'> {
  type = 'skill' as const;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private skillsPath: string;

  constructor(skillsPath: string = '.nexus/skills') {
    super();
    this.skillsPath = skillsPath;
  }

  async initialize(): Promise<void> {
    this.zai = await ZAI.create();
  }

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const skillName = node.config.skillName;
    
    if (!skillName) {
      return {
        nodeId: node.id,
        success: false,
        outputs: {},
        error: 'Skill name not specified',
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    }

    try {
      // Load skill file
      const skillPath = join(this.skillsPath, `${skillName}.skill.md`);
      if (!existsSync(skillPath)) {
        throw new Error(`Skill '${skillName}' not found at ${skillPath}`);
      }

      const skillContent = readFileSync(skillPath, 'utf-8');
      const prompt = this.extractPrompt(skillContent);

      // Execute with LLM
      const response = await this.zai!.chat.completions.create({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(context.inputs) }
        ],
        max_tokens: 4096,
        temperature: 0.7
      });

      const output = response.choices[0]?.message?.content || '';

      return {
        nodeId: node.id,
        success: true,
        outputs: { result: output, tokensUsed: response.usage?.total_tokens || 0 },
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        outputs: {},
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    return !!(node.config.skillName && typeof node.config.skillName === 'string');
  }

  getSchema(): NodePort[] {
    return [
      { name: 'inputs', type: 'object', required: true, description: 'Skill inputs' },
      { name: 'result', type: 'string', required: false, description: 'Skill output' }
    ];
  }

  private extractPrompt(content: string): string {
    const frontMatterMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    return frontMatterMatch ? frontMatterMatch[1].trim() : content;
  }
}
```

---

### Task 1.3: ToolNodeExecutor

**Files:**
- Create: `core/build-node/executors/tool-executor.ts`

```typescript
// core/build-node/executors/tool-executor.ts
import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';
import { toolsRegistry } from '../../tools/registry';

export class ToolNodeExecutor extends NodeExecutor<'tool'> {
  type = 'tool' as const;

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const toolName = node.config.toolName;
    const toolArgs = node.config.toolArgs || {};

    if (!toolName) {
      return {
        nodeId: node.id,
        success: false,
        outputs: {},
        error: 'Tool name not specified',
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    }

    try {
      const tool = toolsRegistry.get(toolName);
      if (!tool) {
        throw new Error(`Tool '${toolName}' not found in registry`);
      }

      // Merge context inputs with tool args
      const args = { ...context.inputs, ...toolArgs };
      const result = await tool.handler(args);

      return {
        nodeId: node.id,
        success: true,
        outputs: { result },
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        outputs: {},
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    return !!(node.config.toolName && typeof node.config.toolName === 'string');
  }

  getSchema(): NodePort[] {
    return [
      { name: 'args', type: 'object', required: true, description: 'Tool arguments' },
      { name: 'result', type: 'any', required: false, description: 'Tool result' }
    ];
  }
}
```

---

### Task 1.4: ConditionNodeExecutor

**Files:**
- Create: `core/build-node/executors/condition-executor.ts`

```typescript
// core/build-node/executors/condition-executor.ts
import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';

export class ConditionNodeExecutor extends NodeExecutor<'condition'> {
  type = 'condition' as const;

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const condition = node.config.condition;

    if (!condition) {
      return {
        nodeId: node.id,
        success: false,
        outputs: {},
        error: 'Condition expression not specified',
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    }

    try {
      const result = this.evaluateCondition(condition, context);
      
      return {
        nodeId: node.id,
        success: true,
        outputs: { 
          result, 
          branch: result ? 'true' : 'false',
          nextNodes: result ? node.config.trueBranch : node.config.falseBranch 
        },
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        outputs: {},
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    return !!(node.config.condition && typeof node.config.condition === 'string');
  }

  getSchema(): NodePort[] {
    return [
      { name: 'condition', type: 'string', required: true, description: 'Condition expression' },
      { name: 'result', type: 'boolean', required: false, description: 'Evaluation result' }
    ];
  }

  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple expression evaluation with context variables
    const variables = { ...context.variables, ...context.inputs };
    
    // Replace variable references
    let expr = condition;
    for (const [key, value] of Object.entries(variables)) {
      expr = expr.replace(new RegExp(`\\$${key}`, 'g'), JSON.stringify(value));
    }
    
    // Safe evaluation (basic expressions only)
    if (/^[\w\s$.'"!=><&|()]+$/.test(expr)) {
      try {
        return new Function(`return ${expr}`)();
      } catch {
        return false;
      }
    }
    
    return false;
  }
}
```

---

### Task 1.5: ParallelNodeExecutor

**Files:**
- Create: `core/build-node/executors/parallel-executor.ts`

```typescript
// core/build-node/executors/parallel-executor.ts
import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';

export class ParallelNodeExecutor extends NodeExecutor<'parallel'> {
  type = 'parallel' as const;
  private nodeExecutors: Map<string, NodeExecutor>;

  constructor(nodeExecutors: Map<string, NodeExecutor>) {
    super();
    this.nodeExecutors = nodeExecutors;
  }

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const parallelNodeIds = node.config.parallelNodes || [];
    const maxConcurrency = node.config.maxConcurrency || 5;
    const failFast = node.config.failFast ?? true;

    if (parallelNodeIds.length === 0) {
      return {
        nodeId: node.id,
        success: true,
        outputs: { results: [] },
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    }

    try {
      const results: NodeExecutionResult[] = [];
      const errors: Error[] = [];

      // Execute in batches
      for (let i = 0; i < parallelNodeIds.length; i += maxConcurrency) {
        const batch = parallelNodeIds.slice(i, i + maxConcurrency);
        const batchPromises = batch.map(nodeId => this.executeNode(nodeId, context));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
            if (!result.value.success && failFast) {
              throw new Error(`Parallel execution failed at node ${result.value.nodeId}`);
            }
          } else {
            errors.push(result.reason);
            if (failFast) {
              throw result.reason;
            }
          }
        }
      }

      return {
        nodeId: node.id,
        success: errors.length === 0,
        outputs: { results, errorCount: errors.length },
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        outputs: {},
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        retryCount: context.retryCount
      };
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    return Array.isArray(node.config.parallelNodes) && node.config.parallelNodes.length > 0;
  }

  getSchema(): NodePort[] {
    return [
      { name: 'nodes', type: 'array', required: true, description: 'Node IDs to execute in parallel' },
      { name: 'results', type: 'array', required: false, description: 'Results from all nodes' }
    ];
  }

  private async executeNode(nodeId: string, context: ExecutionContext): Promise<NodeExecutionResult> {
    // This would be implemented by PipelineExecutor
    return {
      nodeId,
      success: true,
      outputs: {},
      executionTime: 0,
      retryCount: 0
    };
  }
}
```

---

### Task 1.6: PipelineBuilder

**Files:**
- Create: `core/build-node/pipeline-builder.ts`

```typescript
// core/build-node/pipeline-builder.ts
import { BuildNode, BuildPipeline, NodeConnection, PipelineMetadata, PipelineTrigger } from './types';
import { randomUUID } from 'crypto';

export class PipelineBuilder {
  private nodes: Map<string, BuildNode> = new Map();
  private connections: NodeConnection[] = [];
  private variables: Record<string, unknown> = {};
  private triggers: PipelineTrigger[] = [];
  private name: string = 'Untitled Pipeline';
  private description: string = '';

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  addNode(node: Omit<BuildNode, 'id' | 'status' | 'metadata'>): string {
    const id = randomUUID();
    const fullNode: BuildNode = {
      ...node,
      id,
      status: 'pending',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0
      }
    };
    this.nodes.set(id, fullNode);
    return id;
  }

  addSkillNode(name: string, skillName: string, options: Partial<BuildNode['config']> = {}): string {
    return this.addNode({
      type: 'skill',
      name,
      config: { skillName, ...options },
      inputs: [{ name: 'inputs', type: 'object', required: true }],
      outputs: [{ name: 'result', type: 'string', required: false }],
      dependencies: []
    });
  }

  addToolNode(name: string, toolName: string, toolArgs?: Record<string, unknown>): string {
    return this.addNode({
      type: 'tool',
      name,
      config: { toolName, toolArgs },
      inputs: [{ name: 'args', type: 'object', required: true }],
      outputs: [{ name: 'result', type: 'any', required: false }],
      dependencies: []
    });
  }

  addConditionNode(name: string, condition: string, trueBranch: string[], falseBranch: string[]): string {
    return this.addNode({
      type: 'condition',
      name,
      config: { condition, trueBranch, falseBranch },
      inputs: [],
      outputs: [{ name: 'result', type: 'boolean', required: false }],
      dependencies: []
    });
  }

  addParallelNode(name: string, parallelNodes: string[], maxConcurrency?: number): string {
    return this.addNode({
      type: 'parallel',
      name,
      config: { parallelNodes, maxConcurrency },
      inputs: [],
      outputs: [{ name: 'results', type: 'array', required: false }],
      dependencies: []
    });
  }

  connect(sourceId: string, sourcePort: string, targetId: string, targetPort: string): this {
    this.connections.push({
      id: randomUUID(),
      sourceNodeId: sourceId,
      sourcePort,
      targetNodeId: targetId,
      targetPort
    });
    return this;
  }

  setVariable(name: string, value: unknown): this {
    this.variables[name] = value;
    return this;
  }

  addTrigger(trigger: PipelineTrigger): this {
    this.triggers.push(trigger);
    return this;
  }

  build(): BuildPipeline {
    const nodeArray = Array.from(this.nodes.values());
    
    // Resolve dependencies from connections
    for (const conn of this.connections) {
      const targetNode = this.nodes.get(conn.targetNodeId);
      if (targetNode && !targetNode.dependencies.includes(conn.sourceNodeId)) {
        targetNode.dependencies.push(conn.sourceNodeId);
      }
    }

    return {
      id: randomUUID(),
      name: this.name,
      description: this.description,
      version: '1.0.0',
      nodes: nodeArray,
      connections: this.connections,
      variables: this.variables,
      triggers: this.triggers,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0
      }
    };
  }
}
```

---

### Task 1.7: PipelineExecutor

**Files:**
- Create: `core/build-node/pipeline-executor.ts`

```typescript
// core/build-node/pipeline-executor.ts
import { BuildPipeline, BuildNode, ExecutionContext, PipelineExecutionResult, NodeExecutionResult, ExecutionOptions } from './types';
import { NodeExecutor } from './executor';
import { SkillNodeExecutor } from './executors/skill-executor';
import { ToolNodeExecutor } from './executors/tool-executor';
import { ConditionNodeExecutor } from './executors/condition-executor';
import { CodeNodeExecutor } from './executors/code-executor';
import { HTTPNodeExecutor } from './executors/http-executor';
import { TransformNodeExecutor } from './executors/transform-executor';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class PipelineExecutor extends EventEmitter {
  private executors: Map<string, NodeExecutor>;
  private pipelines: Map<string, BuildPipeline> = new Map();

  constructor() {
    super();
    this.executors = new Map([
      ['skill', new SkillNodeExecutor()],
      ['tool', new ToolNodeExecutor()],
      ['condition', new ConditionNodeExecutor()],
      ['code', new CodeNodeExecutor()],
      ['http', new HTTPNodeExecutor()],
      ['transform', new TransformNodeExecutor()]
    ]);
  }

  registerPipeline(pipeline: BuildPipeline): void {
    this.pipelines.set(pipeline.id, pipeline);
  }

  async execute(pipelineId: string, options: ExecutionOptions = {}): Promise<PipelineExecutionResult> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineId}' not found`);
    }

    const executionId = randomUUID();
    const startTime = Date.now();
    const nodeResults = new Map<string, NodeExecutionResult>();
    const failedNodeIds: string[] = [];
    const skippedNodeIds: string[] = [];

    this.emit('pipeline:started', { pipelineId, executionId });

    // Build execution order (topological sort)
    const executionOrder = this.getExecutionOrder(pipeline.nodes);

    // Execute nodes in order
    for (const nodeId of executionOrder) {
      const node = pipeline.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      if (options.skipNodes?.includes(nodeId)) {
        skippedNodeIds.push(nodeId);
        continue;
      }

      this.emit('node:started', { pipelineId, executionId, nodeId });

      const context: ExecutionContext = {
        pipelineId,
        executionId,
        nodeId,
        inputs: this.getNodeInputs(node, nodeResults, pipeline.connections),
        outputs: {},
        state: {},
        variables: { ...pipeline.variables, ...options.variables },
        retryCount: 0,
        startTime: new Date(),
        timeout: options.timeout || node.config.timeout || 60000
      };

      const result = await this.executeNode(node, context, options);
      nodeResults.set(nodeId, result);

      if (result.success) {
        this.emit('node:completed', { pipelineId, executionId, nodeId, result });
      } else {
        failedNodeIds.push(nodeId);
        this.emit('node:failed', { pipelineId, executionId, nodeId, error: result.error });
        
        if (!options.continueOnError && !node.config.continueOnError) {
          break;
        }
      }
    }

    const finalOutputs = this.collectFinalOutputs(pipeline, nodeResults);

    const result: PipelineExecutionResult = {
      pipelineId,
      executionId,
      success: failedNodeIds.length === 0,
      nodeResults,
      finalOutputs,
      totalExecutionTime: Date.now() - startTime,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      failedNodeIds,
      skippedNodeIds
    };

    this.emit('pipeline:completed', { pipelineId, executionId, result });
    return result;
  }

  private async executeNode(node: BuildNode, context: ExecutionContext, options: ExecutionOptions): Promise<NodeExecutionResult> {
    const executor = this.executors.get(node.type);
    if (!executor) {
      return {
        nodeId: node.id,
        success: false,
        outputs: {},
        error: `No executor for node type '${node.type}'`,
        executionTime: 0,
        retryCount: 0
      };
    }

    const maxRetries = options.retryCount ?? node.config.retries ?? 0;
    const retryDelay = options.retryDelay ?? node.config.retryDelay ?? 1000;

    let lastResult: NodeExecutionResult | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      context.retryCount = attempt;
      lastResult = await executor.execute(node, context);

      if (lastResult.success) {
        return lastResult;
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    return lastResult!;
  }

  private getExecutionOrder(nodes: BuildNode[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error(`Cyclic dependency detected at node ${nodeId}`);
      }

      visiting.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }
      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    for (const node of nodes) {
      visit(node.id);
    }

    return order;
  }

  private getNodeInputs(node: BuildNode, results: Map<string, NodeExecutionResult>, connections: any[]): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    
    for (const conn of connections) {
      if (conn.targetNodeId === node.id) {
        const sourceResult = results.get(conn.sourceNodeId);
        if (sourceResult?.outputs[conn.sourcePort]) {
          inputs[conn.targetPort] = sourceResult.outputs[conn.sourcePort];
        }
      }
    }

    return inputs;
  }

  private collectFinalOutputs(pipeline: BuildPipeline, results: Map<string, NodeExecutionResult>): Record<string, unknown> {
    // Find nodes with no outgoing connections (terminal nodes)
    const terminalNodes = pipeline.nodes.filter(node => 
      !pipeline.connections.some(conn => conn.sourceNodeId === node.id)
    );

    const outputs: Record<string, unknown> = {};
    for (const node of terminalNodes) {
      const result = results.get(node.id);
      if (result?.success) {
        outputs[node.name] = result.outputs;
      }
    }

    return outputs;
  }
}
```

---

## Phase 2: Professional Web UI

### Task 2.1: Initialize Next.js 15 App

**Files:**
- Create: `web/package.json`
- Create: `web/next.config.ts`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.js`

**Step 1: Initialize Next.js in web directory**

```bash
cd /home/z/my-project/nexus/web && bun init -y
bun add next@latest react@latest react-dom@latest
bun add -d tailwindcss postcss autoprefixer @types/react @types/react-dom
bunx tailwindcss init -p
```

**Step 2: Configure tailwind.config.ts**

```typescript
// web/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nexus: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

### Task 2.2: Create App Layout and Theme

**Files:**
- Create: `web/app/layout.tsx`
- Create: `web/app/globals.css`
- Create: `web/app/providers.tsx`

```tsx
// web/app/layout.tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'NEXUS - AI Agent Framework',
  description: 'Advanced AI Agent with Conscious/Subconscious Architecture',
  icons: {
    icon: '/nexus-icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```css
/* web/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 199 89% 48%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --muted: 210 40% 96.1%;
    --accent: 199 89% 48%;
    --border: 214.3 31.8% 91.4%;
    --ring: 199 89% 48%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 199 89% 48%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --muted: 217.2 32.6% 17.5%;
    --accent: 217.2 32.6% 17.5%;
    --border: 217.2 32.6% 17.5%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  @apply bg-muted/50;
}

::-webkit-scrollbar-thumb {
  @apply bg-muted-foreground/30 rounded-full;
}

::-webkit-scrollbar-thumb:hover {
  @apply bg-muted-foreground/50;
}

/* Animations */
@keyframes gradient {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.gradient-text {
  @apply bg-clip-text text-transparent bg-gradient-to-r from-nexus-400 via-nexus-600 to-nexus-400;
  background-size: 200% auto;
  animation: gradient 3s linear infinite;
}

/* Glass effect */
.glass {
  @apply bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/30;
}

/* Glow effects */
.glow {
  @apply shadow-[0_0_15px_rgba(14,165,233,0.3)];
}

.glow-sm {
  @apply shadow-[0_0_10px_rgba(14,165,233,0.2)];
}
```

---

### Task 2.3: Create Dashboard Page

**Files:**
- Create: `web/app/page.tsx`
- Create: `web/components/dashboard/DashboardLayout.tsx`
- Create: `web/components/dashboard/Sidebar.tsx`
- Create: `web/components/dashboard/Header.tsx`

```tsx
// web/app/page.tsx
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AgentStatus } from '@/components/agent/AgentStatus';
import { MemoryStats } from '@/components/memory/MemoryStats';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold gradient-text">NEXUS Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            AI Agent Framework with Conscious/Subconscious Architecture
          </p>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AgentStatus />
          <MemoryStats />
          <QuickActions />
        </div>

        {/* Activity */}
        <RecentActivity />
      </div>
    </DashboardLayout>
  );
}
```

---

### Task 2.4: Agent Status Component

**Files:**
- Create: `web/components/agent/AgentStatus.tsx`
- Create: `web/components/agent/AgentChat.tsx`
- Create: `web/components/agent/AgentMetrics.tsx`

```tsx
// web/components/agent/AgentStatus.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Activity, Zap, Clock } from 'lucide-react';

interface AgentState {
  status: 'idle' | 'processing' | 'dreaming' | 'error';
  phase: 'conscious' | 'subconscious';
  sessionId: string | null;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    dreamCyclesCompleted: number;
    totalTokensUsed: number;
  };
}

export function AgentStatus() {
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAgentStatus() {
    try {
      const response = await fetch('/api/nexus/agent/status');
      const data = await response.json();
      setAgentState(data);
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="glass glow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    idle: 'bg-green-500',
    processing: 'bg-blue-500 animate-pulse',
    dreaming: 'bg-purple-500 animate-pulse',
    error: 'bg-red-500',
  };

  return (
    <Card className="glass glow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
        <Brain className="h-4 w-4 text-nexus-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColors[agentState?.status || 'idle']}`}></div>
            <span className="text-2xl font-bold capitalize">{agentState?.status || 'Unknown'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={agentState?.phase === 'conscious' ? 'default' : 'secondary'}>
              {agentState?.phase || 'conscious'}
            </Badge>
            {agentState?.sessionId && (
              <span className="font-mono text-xs">{agentState.sessionId.slice(0, 8)}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span>{agentState?.metrics.tasksCompleted || 0} tasks</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>{agentState?.metrics.dreamCyclesCompleted || 0} dreams</span>
            </div>
            <div className="flex items-center gap-1 col-span-2">
              <Clock className="h-3 w-3" />
              <span>{(agentState?.metrics.totalTokensUsed || 0).toLocaleString()} tokens</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### Task 2.5: Agent Chat Interface

**Files:**
- Create: `web/components/agent/AgentChat.tsx`
- Create: `web/app/chat/page.tsx`

```tsx
// web/components/agent/AgentChat.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  reasoning?: string;
  toolsUsed?: string[];
}

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/nexus/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content || data.output?.content || 'No response',
        timestamp: new Date(),
        reasoning: data.reasoning,
        toolsUsed: data.toolsUsed,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Failed to get response from agent',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass flex flex-col h-[600px]">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-nexus-500" />
            NEXUS Chat
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm text-muted-foreground">Online</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot className="h-12 w-12 mb-4 text-nexus-500/50" />
            <p className="text-lg font-medium">Start a conversation with NEXUS</p>
            <p className="text-sm">Ask anything, request tasks, or explore capabilities</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user'
                  ? 'bg-nexus-500 text-white'
                  : 'bg-muted'
              }`}
            >
              {message.role === 'user' ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>
            
            <div
              className={`flex-1 space-y-2 ${
                message.role === 'user' ? 'text-right' : ''
              }`}
            >
              <div
                className={`inline-block p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-nexus-500 text-white'
                    : message.role === 'system'
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              
              {message.reasoning && (
                <details className="text-left">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    View reasoning
                  </summary>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                    {message.reasoning}
                  </div>
                </details>
              )}
              
              {message.toolsUsed && message.toolsUsed.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {message.toolsUsed.map((tool) => (
                    <span
                      key={tool}
                      className="text-xs px-2 py-0.5 bg-nexus-500/10 text-nexus-600 rounded"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="flex-shrink-0 p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message to NEXUS..."
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

---

### Task 2.6: Memory Visualization

**Files:**
- Create: `web/components/memory/MemoryStats.tsx`
- Create: `web/components/memory/MemoryExplorer.tsx`
- Create: `web/app/memory/page.tsx`

```tsx
// web/components/memory/MemoryExplorer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Database, Clock, TrendingUp } from 'lucide-react';

interface Memory {
  id: string;
  content: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'working';
  importance: number;
  createdAt: string;
  similarity?: number;
}

export function MemoryExplorer() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  async function searchMemories(query: string) {
    if (!query.trim()) {
      setMemories([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/nexus/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 20 }),
      });
      const data = await response.json();
      setMemories(data.memories || []);
    } catch (error) {
      console.error('Failed to search memories:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => searchMemories(searchQuery), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const typeColors = {
    episodic: 'bg-blue-500',
    semantic: 'bg-green-500',
    procedural: 'bg-purple-500',
    working: 'bg-yellow-500',
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-nexus-500" />
          Memory Explorer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories semantically..."
            className="pl-10"
          />
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Searching...
            </div>
          )}

          {!loading && memories.length === 0 && searchQuery && (
            <div className="text-center py-8 text-muted-foreground">
              No memories found for "{searchQuery}"
            </div>
          )}

          {!loading && memories.length === 0 && !searchQuery && (
            <div className="text-center py-8 text-muted-foreground">
              Start typing to search memories
            </div>
          )}

          {memories.map((memory) => (
            <div
              key={memory.id}
              className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge
                  variant="secondary"
                  className={`${typeColors[memory.type]} text-white`}
                >
                  {memory.type}
                </Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {memory.similarity && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {(memory.similarity * 100).toFixed(0)}%
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(memory.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="text-sm line-clamp-3">{memory.content}</p>
              <div className="mt-2 flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Importance:</span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-nexus-500"
                    style={{ width: `${memory.importance * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {(memory.importance * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### Task 2.7: Pipeline Builder UI

**Files:**
- Create: `web/components/pipeline/PipelineBuilder.tsx`
- Create: `web/components/pipeline/NodePalette.tsx`
- Create: `web/app/pipeline/page.tsx`

```tsx
// web/components/pipeline/PipelineBuilder.tsx
'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GitBranch, 
  Play, 
  Save, 
  Plus, 
  Trash2,
  Settings,
  Zap,
  Code,
  Globe,
  Database
} from 'lucide-react';

interface PipelineNode {
  id: string;
  type: 'skill' | 'tool' | 'condition' | 'parallel' | 'code' | 'http';
  name: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
}

const nodeTypeIcons = {
  skill: Zap,
  tool: Settings,
  condition: GitBranch,
  parallel: GitBranch,
  code: Code,
  http: Globe,
};

const nodeTypeColors = {
  skill: 'bg-yellow-500',
  tool: 'bg-blue-500',
  condition: 'bg-purple-500',
  parallel: 'bg-green-500',
  code: 'bg-gray-500',
  http: 'bg-orange-500',
};

export function PipelineBuilder() {
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const addNode = useCallback((type: PipelineNode['type']) => {
    const newNode: PipelineNode = {
      id: crypto.randomUUID(),
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
      x: 100 + Math.random() * 400,
      y: 100 + Math.random() * 300,
      config: {},
    };
    setNodes(prev => [...prev, newNode]);
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    if (selectedNode === id) setSelectedNode(null);
  }, [selectedNode]);

  return (
    <div className="grid grid-cols-[300px_1fr] gap-4 h-[700px]">
      {/* Node Palette */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Node Palette</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(['skill', 'tool', 'condition', 'parallel', 'code', 'http'] as const).map((type) => {
            const Icon = nodeTypeIcons[type];
            return (
              <Button
                key={type}
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => addNode(type)}
              >
                <Icon className="h-4 w-4" />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            );
          })}

          <div className="pt-4 border-t mt-4">
            <h4 className="text-sm font-medium mb-2">Actions</h4>
            <div className="space-y-2">
              <Button className="w-full gap-2" disabled={nodes.length === 0}>
                <Play className="h-4 w-4" />
                Run Pipeline
              </Button>
              <Button variant="outline" className="w-full gap-2" disabled={nodes.length === 0}>
                <Save className="h-4 w-4" />
                Save Pipeline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Canvas */}
      <Card className="glass overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-lg">Canvas</CardTitle>
          <Badge variant="secondary">{nodes.length} nodes</Badge>
        </CardHeader>
        <CardContent className="p-0 relative h-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-muted/20 from-0% to-transparent to-100%">
          {/* Grid background */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground)/0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Nodes */}
          <div className="absolute inset-0">
            {nodes.map((node) => {
              const Icon = nodeTypeIcons[node.type];
              return (
                <div
                  key={node.id}
                  className={`absolute w-48 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedNode === node.id
                      ? 'border-nexus-500 shadow-lg shadow-nexus-500/20'
                      : 'border-border hover:border-nexus-500/50'
                  }`}
                  style={{ left: node.x, top: node.y }}
                  onClick={() => setSelectedNode(node.id)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded ${nodeTypeColors[node.type]} flex items-center justify-center`}>
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    <span className="font-medium text-sm truncate">{node.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{node.type}</Badge>
                  
                  {selectedNode === node.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Plus className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Add nodes from the palette to start building</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Task 2.8: UI Components (shadcn/ui style)

**Files:**
- Create: `web/components/ui/button.tsx`
- Create: `web/components/ui/card.tsx`
- Create: `web/components/ui/badge.tsx`
- Create: `web/components/ui/input.tsx`
- Create: `web/components/ui/textarea.tsx`

```tsx
// web/components/ui/button.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

---

## Phase 3: API Routes

### Task 3.1: Agent Status API

**Files:**
- Create: `web/app/api/nexus/agent/status/route.ts`
- Create: `web/app/api/nexus/agent/chat/route.ts`

```typescript
// web/app/api/nexus/agent/status/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Singleton agent instance
let agentInstance: any = null;

async function getAgent() {
  if (!agentInstance) {
    const { Agent } = await import('@/core/agent');
    agentInstance = new Agent({
      id: 'nexus-web-agent',
      name: 'NEXUS',
      autoStartDreamCycles: false,
    });
    await agentInstance.initialize();
  }
  return agentInstance;
}

export async function GET(request: NextRequest) {
  try {
    const agent = await getAgent();
    const state = agent.getState();
    const metrics = agent.getMetrics();

    return NextResponse.json({
      ...state,
      metrics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get agent status' },
      { status: 500 }
    );
  }
}
```

```typescript
// web/app/api/nexus/agent/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

let agentInstance: any = null;

async function getAgent() {
  if (!agentInstance) {
    const { Agent } = await import('@/core/agent');
    agentInstance = new Agent({
      id: 'nexus-web-agent',
      name: 'NEXUS',
      autoStartDreamCycles: false,
    });
    await agentInstance.initialize();
  }
  return agentInstance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const agent = await getAgent();
    const output = await agent.processInput(message);

    return NextResponse.json({
      content: output.content,
      reasoning: output.reasoning,
      toolsUsed: output.toolsUsed,
      tokensUsed: output.tokensUsed,
      confidence: output.confidence,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
```

---

### Task 3.2: Memory API

**Files:**
- Create: `web/app/api/nexus/memory/search/route.ts`
- Create: `web/app/api/nexus/memory/store/route.ts`

```typescript
// web/app/api/nexus/memory/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const { VectorStore } = await import('@/core/vector-store');
    const store = new VectorStore();
    await store.initialize();

    const results = await store.search(query, limit);

    return NextResponse.json({
      memories: results.map(r => ({
        id: r.id,
        content: r.content,
        type: r.type,
        importance: r.importance,
        similarity: r.similarity,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Memory search error:', error);
    return NextResponse.json(
      { error: 'Memory search failed' },
      { status: 500 }
    );
  }
}
```

---

## Phase 4: CLI Enhancement

### Task 4.1: Enhanced CLI Commands

**Files:**
- Update: `cli/commands.ts`

Add commands for:
- `nexus pipeline create` - Create new pipeline
- `nexus pipeline run <id>` - Execute pipeline
- `nexus skill install <name>` - Install skill from ClawHub
- `nexus web` - Start web UI
- `nexus docker start` - Start Docker containers

---

## Summary

This plan covers:

1. **Build Node System** (Tasks 1.1-1.7) - Complete OpenClaw-style pipeline executor
2. **Web UI** (Tasks 2.1-2.8) - Professional Next.js 15 dashboard
3. **API Routes** (Tasks 3.1-3.2) - REST endpoints for agent interaction
4. **CLI Enhancement** (Task 4.1) - Additional CLI commands

Total estimated tasks: ~35 bite-sized steps
Estimated implementation time: 2-3 days of focused work
