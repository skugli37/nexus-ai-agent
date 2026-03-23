# NEXUS Remove Hardcoding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove ALL hardcoded values, default data, and mock implementations. Connect UI directly to NEXUS core backend with real data flow.

**Architecture:** API routes will proxy to NEXUS core (nexus/core/*) modules. UI components will fetch real data from API. Pipeline execution will use actual PipelineExecutor from build-node system.

**Tech Stack:** Next.js 16, TypeScript, NEXUS Core (agent.ts, vector-store.ts, pipeline-executor.ts), z-ai-web-dev-sdk

---

## Task 1: Create NEXUS Core Bridge

**Files:**
- Create: `src/lib/nexus-core.ts`
- Modify: `src/app/api/nexus/status/route.ts`

**Step 1: Create NEXUS Core Bridge**

```typescript
// src/lib/nexus-core.ts
import { NexusAgent } from '@/nexus/core/agent';
import { VectorStore } from '@/nexus/core/vector-store';
import { PipelineExecutor } from '@/nexus/core/build-node/pipeline-executor';
import { ToolForge } from '@/nexus/core/tool-forge';
import { SkillExecutor } from '@/nexus/core/skill-executor';

let agentInstance: NexusAgent | null = null;
let vectorStoreInstance: VectorStore | null = null;
let pipelineExecutorInstance: PipelineExecutor | null = null;

export async function getAgent(): Promise<NexusAgent> {
  if (!agentInstance) {
    agentInstance = new NexusAgent();
    await agentInstance.initialize();
  }
  return agentInstance;
}

export async function getVectorStore(): Promise<VectorStore> {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
    await vectorStoreInstance.load();
  }
  return vectorStoreInstance;
}

export async function getPipelineExecutor(): Promise<PipelineExecutor> {
  if (!pipelineExecutorInstance) {
    pipelineExecutorInstance = new PipelineExecutor();
  }
  return pipelineExecutorInstance;
}

export async function getSystemMetrics(): Promise<{
  memoryUsage: number;
  toolsCount: number;
  skillsCount: number;
  pipelinesCount: number;
}> {
  const vectorStore = await getVectorStore();
  const memories = await vectorStore.getAll();
  
  // Real memory usage from process
  const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
  
  // Count real tools from nexus/tools directory
  const fs = await import('fs');
  const path = await import('path');
  const toolsDir = path.join(process.cwd(), 'nexus', 'tools');
  let toolsCount = 0;
  try {
    const files = fs.readdirSync(toolsDir);
    toolsCount = files.filter(f => f.endsWith('.ts') || f.endsWith('.js')).length;
  } catch {}
  
  // Count real skills
  const skillsDir = path.join(process.cwd(), 'nexus', 'skills');
  let skillsCount = 0;
  try {
    const dirs = fs.readdirSync(skillsDir, { withFileTypes: true });
    skillsCount = dirs.filter(d => d.isDirectory()).length;
  } catch {}
  
  return {
    memoryUsage: Math.round(memoryUsage),
    toolsCount,
    skillsCount,
    pipelinesCount: 0
  };
}
```

**Step 2: Update status route to use real data**

```typescript
// src/app/api/nexus/status/route.ts - COMPLETE REWRITE
import { NextResponse } from 'next/server';
import { getAgent, getVectorStore, getSystemMetrics } from '@/lib/nexus-core';

export async function GET() {
  try {
    const [agent, vectorStore, metrics] = await Promise.all([
      getAgent().catch(() => null),
      getVectorStore().catch(() => null),
      getSystemMetrics().catch(() => ({
        memoryUsage: 0,
        toolsCount: 0,
        skillsCount: 0,
        pipelinesCount: 0
      }))
    ]);
    
    // Get real memories from vector store
    const memories = vectorStore ? await vectorStore.getAll() : [];
    
    // Get real agent state
    const state = agent ? agent.getState() : {
      status: 'idle',
      phase: 'conscious',
      sessionId: null,
      lastActivity: new Date().toISOString()
    };
    
    // Get real metrics
    const agentMetrics = agent ? agent.getMetrics() : {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      dreamCyclesCompleted: 0,
      learningIterations: 0
    };
    
    // Calculate real memory stats
    const byType: Record<string, number> = {};
    for (const memory of memories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
    }
    
    return NextResponse.json({
      state,
      metrics: agentMetrics,
      memories: memories.slice(-20),
      memoryStats: {
        total: memories.length,
        byType
      },
      systemMetrics: metrics,
      skills: [],  // Will be fetched from skills directory
      tools: []    // Will be fetched from tools directory
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({
      state: { status: 'error', phase: 'conscious', sessionId: null, lastActivity: new Date().toISOString() },
      metrics: { tasksCompleted: 0, tasksFailed: 0, averageResponseTime: 0, totalTokensUsed: 0, dreamCyclesCompleted: 0, learningIterations: 0 },
      memories: [],
      memoryStats: { total: 0, byType: {} },
      systemMetrics: { memoryUsage: 0, toolsCount: 0, skillsCount: 0, pipelinesCount: 0 },
      skills: [],
      tools: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

---

## Task 2: Remove Default Tools Hardcoding

**Files:**
- Modify: `src/app/api/nexus/tools/route.ts`
- Modify: `src/components/nexus/ToolPanel.tsx`

**Step 1: Rewrite tools API to use real ToolForge**

```typescript
// src/app/api/nexus/tools/route.ts - COMPLETE REWRITE
import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus');
}

function getToolsDir(): string {
  return join(getNexusHome(), 'tools');
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Array<{ name: string; type: string; description: string; required: boolean }>;
  enabled: boolean;
  lastUsed?: string;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

// Load tools from filesystem - NO DEFAULTS
async function loadToolsFromFS(): Promise<Tool[]> {
  const toolsDir = getToolsDir();
  const tools: Tool[] = [];
  
  if (!existsSync(toolsDir)) {
    mkdirSync(toolsDir, { recursive: true });
    return tools;  // Return empty array, no defaults
  }
  
  const files = readdirSync(toolsDir, { recursive: true }) as string[];
  
  for (const file of files) {
    if (file.endsWith('.tool.ts') || file.endsWith('.tool.js')) {
      try {
        const content = readFileSync(join(toolsDir, file), 'utf-8');
        // Parse tool metadata from file
        const nameMatch = content.match(/name:\s*['"](.+?)['"]/);
        const descMatch = content.match(/description:\s*['"](.+?)['"]/);
        
        tools.push({
          id: file.replace(/\.(tool\.ts|tool\.js)$/, ''),
          name: nameMatch?.[1] || file.replace(/\.(tool\.ts|tool\.js)$/, ''),
          description: descMatch?.[1] || '',
          category: 'custom',
          parameters: [],
          enabled: true,
          usageCount: 0,
          createdAt: new Date().toISOString()
        });
      } catch {}
    }
  }
  
  // Also check config/tools.json for registered tools
  const configPath = join(getNexusHome(), 'config', 'tools.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (config.tools && Array.isArray(config.tools)) {
        // Merge with file-based tools
        for (const tool of config.tools) {
          if (!tools.find(t => t.name === tool.name)) {
            tools.push(tool);
          }
        }
      }
    } catch {}
  }
  
  return tools;
}

export async function GET() {
  const tools = await loadToolsFromFS();
  return NextResponse.json({ tools });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category, parameters, enabled } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'Tool name is required' }, { status: 400 });
    }
    
    const toolsDir = getToolsDir();
    if (!existsSync(toolsDir)) {
      mkdirSync(toolsDir, { recursive: true });
    }
    
    const toolId = name.toLowerCase().replace(/\s+/g, '-');
    const toolPath = join(toolsDir, `${toolId}.tool.ts`);
    
    const toolContent = `/**
 * Tool: ${name}
 * ${description || 'Custom tool'}
 */

export const ${toolId.replace(/-/g, '_')} = {
  name: '${name}',
  description: '${description || ''}',
  category: '${category || 'custom'}',
  parameters: ${JSON.stringify(parameters || [], null, 2)},
  execute: async (args: Record<string, unknown>) => {
    // Tool implementation
    return { success: true, result: args };
  }
};

export default ${toolId.replace(/-/g, '_')};
`;
    
    writeFileSync(toolPath, toolContent);
    
    const newTool: Tool = {
      id: toolId,
      name,
      description: description || '',
      category: category || 'custom',
      parameters: parameters || [],
      enabled: enabled !== false,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };
    
    return NextResponse.json({ success: true, tool: newTool });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }
    
    const toolPath = join(getToolsDir(), `${id}.tool.ts`);
    if (existsSync(toolPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(toolPath);
    }
    
    return NextResponse.json({ success: true, message: `Tool '${id}' deleted` });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Update ToolPanel to not use defaultTools**

```typescript
// In src/components/nexus/ToolPanel.tsx, REMOVE defaultTools constant
// Change line 226 from:
const [tools, setTools] = React.useState<Tool[]>(defaultTools);
// To:
const [tools, setTools] = React.useState<Tool[]>([]);  // Start empty

// Add loading state
const [isLoading, setIsLoading] = React.useState(true);

// In useEffect, fetch real tools:
React.useEffect(() => {
  const fetchTools = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/nexus/tools');
      if (response.ok) {
        const data = await response.json();
        setTools(data.tools || []);  // Use only API data, no fallback
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      setTools([]);  // Empty on error, no defaults
    } finally {
      setIsLoading(false);
    }
  };
  fetchTools();
}, []);
```

---

## Task 3: Remove Default Skills Hardcoding

**Files:**
- Modify: `src/app/api/nexus/skills/route.ts`
- Modify: `src/components/nexus/SkillPanel.tsx`

**Step 1: Rewrite skills API**

```typescript
// src/app/api/nexus/skills/route.ts - Load from filesystem
import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus');
}

interface Skill {
  name: string;
  description: string;
  version: string;
  tags: string[];
  installed: boolean;
  author?: string;
}

// Load skills from skills directory - NO DEFAULTS
async function loadSkillsFromFS(): Promise<Skill[]> {
  const skillsDir = join(getNexusHome(), 'skills');
  const skills: Skill[] = [];
  
  if (!existsSync(skillsDir)) {
    return skills;  // Return empty, no defaults
  }
  
  const dirs = readdirSync(skillsDir, { withFileTypes: true });
  
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    
    const skillPath = join(skillsDir, dir.name, 'SKILL.md');
    if (existsSync(skillPath)) {
      try {
        const content = readFileSync(skillPath, 'utf-8');
        // Parse YAML frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        const frontmatter: Record<string, string | string[]> = {};
        
        if (frontmatterMatch) {
          for (const line of frontmatterMatch[1].split('\n')) {
            const match = line.match(/^(\w+):\s*(.*)$/);
            if (match) {
              const key = match[1];
              const value = match[2].trim();
              if (value.startsWith('[')) {
                frontmatter[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
              } else {
                frontmatter[key] = value.replace(/['"]/g, '');
              }
            }
          }
        }
        
        skills.push({
          name: (frontmatter.name as string) || dir.name,
          description: (frontmatter.description as string) || '',
          version: (frontmatter.version as string) || '1.0.0',
          tags: (frontmatter.tags as string[]) || [],
          installed: true,
          author: (frontmatter.author as string) || 'Unknown'
        });
      } catch {}
    }
  }
  
  return skills;
}

export async function GET() {
  const skills = await loadSkillsFromFS();
  return NextResponse.json({ skills });
}

export async function POST(request: NextRequest) {
  // Install skill from ClawHub or create new
  // Implementation for installing skills
}

export async function DELETE(request: NextRequest) {
  // Uninstall skill
}
```

**Step 2: Update SkillPanel - REMOVE defaultSkills**

```typescript
// In src/components/nexus/SkillPanel.tsx, DELETE the defaultSkills constant (lines 51-112)
// Change line 283:
const [skills, setSkills] = React.useState<Skill[]>([]);  // Empty, no defaults
const [isLoading, setIsLoading] = React.useState(true);

// Update fetchSkills to not use defaults
React.useEffect(() => {
  const fetchSkills = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/nexus/status');
      if (response.ok) {
        const data = await response.json();
        setSkills(data.skills || []);  // Only API data
      }
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      setSkills([]);  // Empty on error
    } finally {
      setIsLoading(false);
    }
  };
  fetchSkills();
}, []);
```

---

## Task 4: Implement Real Pipeline Execution

**Files:**
- Modify: `src/app/api/nexus/pipeline/route.ts`
- Modify: `src/components/nexus/PipelineBuilder.tsx`

**Step 1: Connect pipeline API to real PipelineExecutor**

```typescript
// src/app/api/nexus/pipeline/route.ts - COMPLETE REWRITE
import { NextRequest, NextResponse } from 'next/server';
import { getPipelineExecutor } from '@/lib/nexus-core';
import { BuildPipeline } from '@/nexus/core/build-node/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, nodes, connections } = body;
    
    // Build pipeline from request
    const pipeline: BuildPipeline = {
      id: `pipeline-${Date.now()}`,
      name: name || 'Untitled Pipeline',
      version: '1.0.0',
      nodes: nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        config: n.config || {},
        inputs: [],
        outputs: [],
        dependencies: [],
        status: 'pending',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0
        },
        position: { x: n.x || 0, y: n.y || 0 }
      })),
      connections: connections.map((c: any) => ({
        id: c.id || `conn-${Date.now()}`,
        sourceNodeId: c.sourceId,
        sourcePort: c.sourcePort || 'output',
        targetNodeId: c.targetId,
        targetPort: c.targetPort || 'input'
      })),
      variables: {},
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0
      }
    };
    
    // Execute using real PipelineExecutor
    const executor = await getPipelineExecutor();
    executor.registerPipeline(pipeline);
    
    const result = await executor.execute(pipeline.id);
    
    return NextResponse.json({
      success: result.success,
      executionId: result.executionId,
      nodeResults: Array.from(result.nodeResults.entries()).map(([id, r]) => ({
        nodeId: id,
        success: r.success,
        outputs: r.outputs,
        error: r.error,
        executionTime: r.executionTime
      })),
      totalExecutionTime: result.totalExecutionTime,
      failedNodeIds: result.failedNodeIds
    });
  } catch (error) {
    console.error('Pipeline execution error:', error);
    return NextResponse.json(
      { error: 'Pipeline execution failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // List saved pipelines
  return NextResponse.json({ pipelines: [] });
}
```

**Step 2: Update PipelineBuilder - REMOVE simulation**

```typescript
// In src/components/nexus/PipelineBuilder.tsx, replace runPipeline function (lines 362-386):

const runPipeline = async () => {
  setIsRunning(true);
  
  // Reset all node statuses
  setNodes(nodes.map(n => ({ ...n, status: 'pending' as const })));

  try {
    const response = await fetch('/api/nexus/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: pipelineName,
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          name: n.name,
          config: n.config,
          x: n.x,
          y: n.y
        })),
        connections: connections.map(c => ({
          id: c.id,
          sourceId: c.sourceId,
          targetId: c.targetId,
          sourcePort: 'output',
          targetPort: 'input'
        }))
      })
    });

    if (!response.ok) {
      throw new Error('Pipeline execution failed');
    }

    const result = await response.json();
    
    // Update node statuses based on real results
    for (const nodeResult of result.nodeResults) {
      setNodes(prev => prev.map(n => 
        n.id === nodeResult.nodeId 
          ? { ...n, status: nodeResult.success ? 'completed' : 'failed' }
          : n
      ));
    }
  } catch (error) {
    console.error('Pipeline error:', error);
    // Mark all pending nodes as failed
    setNodes(prev => prev.map(n => 
      n.status === 'pending' ? { ...n, status: 'failed' } : n
    ));
  } finally {
    setIsRunning(false);
  }
};
```

---

## Task 5: Update AgentStatus with Real Metrics

**Files:**
- Modify: `src/components/nexus/AgentStatus.tsx`

**Step 1: Remove hardcoded "128 MB" and "12 tools"**

```typescript
// In src/components/nexus/AgentStatus.tsx, add to state:
const [systemMetrics, setSystemMetrics] = React.useState({
  memoryUsage: 0,
  toolsCount: 0,
  skillsCount: 0,
  pipelinesCount: 0
});

// In fetchStatus, also fetch system metrics:
const fetchStatus = React.useCallback(async () => {
  try {
    const response = await fetch('/api/nexus/status');
    if (response.ok) {
      const data = await response.json();
      setState(data.state);
      setMetrics(data.metrics);
      if (data.systemMetrics) {
        setSystemMetrics(data.systemMetrics);
      }
    }
  } catch (error) {
    console.error('Failed to fetch status:', error);
  } finally {
    setIsLoading(false);
  }
}, []);

// Replace hardcoded values (lines 304 and 318):
// From: <p className="text-lg font-bold text-slate-100">128 MB</p>
// To: <p className="text-lg font-bold text-slate-100">{systemMetrics.memoryUsage} MB</p>

// From: <p className="text-lg font-bold text-slate-100">12</p>
// To: <p className="text-lg font-bold text-slate-100">{systemMetrics.toolsCount}</p>
```

---

## Task 6: Use UUID instead of Math.random for IDs

**Files:**
- Modify: `src/app/api/nexus/chat/route.ts`
- Modify: `src/app/api/nexus/memory/route.ts`
- Modify: `src/app/api/nexus/dream/route.ts`

**Step 1: Replace Math.random with crypto.randomUUID or uuid package**

```typescript
// In all files, replace:
id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
// With:
id: crypto.randomUUID(),
```

---

## Verification Steps

**After implementation, verify:**

1. `curl http://localhost:3000/api/nexus/status` - Should return empty arrays if no data
2. `curl http://localhost:3000/api/nexus/tools` - Should return empty array if no tools created
3. `curl http://localhost:3000/api/nexus/skills` - Should return empty array if no skills installed
4. Pipeline builder should show real execution results, not random
5. AgentStatus should show real memory usage and tool counts

---

## Files Modified Summary

| File | Change |
|------|--------|
| `src/lib/nexus-core.ts` | NEW - Bridge to NEXUS core |
| `src/app/api/nexus/status/route.ts` | Use real agent state |
| `src/app/api/nexus/tools/route.ts` | Remove defaultTools, load from FS |
| `src/app/api/nexus/skills/route.ts` | Load from skills directory |
| `src/app/api/nexus/pipeline/route.ts` | Use real PipelineExecutor |
| `src/app/api/nexus/chat/route.ts` | Use crypto.randomUUID |
| `src/app/api/nexus/memory/route.ts` | Use crypto.randomUUID |
| `src/app/api/nexus/dream/route.ts` | Use crypto.randomUUID |
| `src/components/nexus/ToolPanel.tsx` | Remove defaultTools |
| `src/components/nexus/SkillPanel.tsx` | Remove defaultSkills |
| `src/components/nexus/PipelineBuilder.tsx` | Remove simulation |
| `src/components/nexus/AgentStatus.tsx` | Use real metrics |

---

**Plan complete and saved to `docs/plans/2026-03-23-nexus-remove-hardcoding.md`.**
