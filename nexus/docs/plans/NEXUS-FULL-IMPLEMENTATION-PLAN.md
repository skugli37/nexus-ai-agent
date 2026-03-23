# NEXUS AI Agent - Full Implementation Plan
## Goal: surpass Agent-Zero and OpenClaw

**Version:** 3.0.0
**Created:** 2025-03-23
**Status:** READY FOR IMPLEMENTATION

---

## 📊 CURRENT STATE ANALYSIS

### ✅ Already Implemented
| Component | Status | Location |
|-----------|--------|----------|
| Agent Core | ✅ WORKS | `nexus/core/agent.ts` |
| Conscious Module | ✅ WORKS | `nexus/core/conscious.ts` |
| Subconscious Module | ✅ WORKS | `nexus/core/subconscious.ts` |
| Vector Store | ✅ WORKS | `nexus/core/vector-store.ts` |
| WebSocket Server | ✅ WORKS | `nexus/core/websocket-server.ts` |
| HTTP Server | ✅ WORKS | `nexus/server.ts` |
| Tool Forge | ✅ WORKS | `nexus/core/tool-forge.ts` |
| Code Sandbox | ✅ WORKS | `nexus/core/sandbox.ts` |
| Build Node Pipeline | ✅ WORKS | `nexus/core/build-node/` |
| Docker Images | ✅ EXISTS | `nexus/docker/` |
| CLI Base | ✅ WORKS | `nexus/cli/` |
| Frontend Components | ✅ EXISTS | `src/components/nexus/` |
| WebSocket Hook | ✅ WORKS | `src/hooks/useNexusWebSocket.ts` |
| API Routes | ✅ WORKS | `src/app/api/nexus/` |

### ❌ Not Connected/Missing
| Component | Issue | Priority |
|-----------|-------|----------|
| Frontend ↔ Backend | Not connected via WebSocket | CRITICAL |
| code_execute | Not exposed in chat API | HIGH |
| web_search | Not implemented | HIGH |
| Build Node Integration | Not connected to chat | MEDIUM |
| CLI Autonomous Mode | Missing | MEDIUM |
| Docker Compose | Missing | MEDIUM |
| Real-time UI Updates | Missing | HIGH |
| Skills Ecosystem | Basic only | LOW |

---

## 🎯 COMPETITIVE ANALYSIS

### OpenClaw Advantages to Beat
- 100+ pre-configured skills → **NEXUS: Self-generating skills via Tool Forge**
- Multi-channel support → **NEXUS: Add messaging adapters**
- 80% reduced latency → **NEXUS: Optimize with streaming**
- Production templates → **NEXUS: Add deployment templates**

### Agent-Zero Advantages to Beat
- 13.2k GitHub stars → **NEXUS: Better architecture = organic growth**
- Self-evolving → **NEXUS: Already have Conscious/Subconscious**
- Dynamic tool creation → **NEXUS: Tool Forge already exists**
- Docker image → **NEXUS: Already have Dockerfiles**
- Dashboard → **NEXUS: Build better UI**

---

## 📋 IMPLEMENTATION PHASES

---

# PHASE 1: Frontend-Backend Integration
**Priority:** CRITICAL
**Duration:** 2-3 hours
**Goal:** Connect Next.js frontend to NEXUS backend via WebSocket

## 1.1 Backend API Route for WebSocket Proxy

### Files to Create/Modify:
```
src/app/api/nexus/ws/route.ts          [MODIFY] - Add WebSocket upgrade handler
src/lib/nexus-websocket-client.ts       [CREATE] - Backend WebSocket client
```

### Implementation:

```typescript
// src/app/api/nexus/ws/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // WebSocket upgrade handling for Next.js
  const upgradeHeader = request.headers.get('upgrade');
  
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }
  
  // This will be handled by the standalone server
  // Return connection info for client
  return new Response(JSON.stringify({
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002',
    httpUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### ✅ Checklist Phase 1.1:
- [ ] Create `src/lib/nexus-websocket-client.ts`
- [ ] Update WebSocket hook to use correct URL
- [ ] Add environment variables for backend URLs
- [ ] Test connection from frontend to backend

---

## 1.2 Update Frontend WebSocket Hook

### Files to Modify:
```
src/hooks/useNexusWebSocket.ts    [MODIFY]
src/components/nexus/AgentChat.tsx [MODIFY]
```

### Key Changes:
1. Fix WebSocket URL configuration
2. Add real-time message streaming
3. Add connection status indicator
4. Add reconnection logic

### ✅ Checklist Phase 1.2:
- [ ] Update WebSocket URL to point to backend port 3002
- [ ] Add connection status indicator in UI
- [ ] Test message sending/receiving
- [ ] Test reconnection on disconnect

---

## 1.3 Create Unified Server Start Script

### Files to Create:
```
nexus/start-all.sh    [CREATE]
nexus/package.json    [MODIFY]
```

### Implementation:

```bash
#!/bin/bash
# nexus/start-all.sh
# Starts both backend server and frontend dev server

echo "🚀 Starting NEXUS Full Stack..."

# Start backend server in background
echo "📡 Starting Backend Server..."
cd nexus && bun run server.ts --port 3001 --ws-port 3002 &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "🌐 Starting Frontend..."
cd .. && bun run dev &
FRONTEND_PID=$!

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo "✅ NEXUS is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   WebSocket: ws://localhost:3002"

wait
```

### ✅ Checklist Phase 1.3:
- [ ] Create start-all.sh script
- [ ] Add npm scripts for unified start
- [ ] Test both servers starting together
- [ ] Verify WebSocket connection

---

# PHASE 2: Code Execute Integration
**Priority:** HIGH
**Duration:** 2-3 hours
**Goal:** Expose code_execute in chat API with file creation capability

## 2.1 Create Code Execute API Route

### Files to Create:
```
src/app/api/nexus/execute/route.ts    [CREATE]
nexus/core/file-sandbox.ts             [CREATE] - Extended sandbox with file ops
```

### Implementation:

```typescript
// src/app/api/nexus/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CodeSandbox } from '@/lib/nexus-bridge';
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SANDBOX_ROOT = join(homedir(), '.nexus', 'sandbox');

// Ensure sandbox directory exists
if (!existsSync(SANDBOX_ROOT)) {
  mkdirSync(SANDBOX_ROOT, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      code, 
      language = 'javascript',
      inputs = {},
      files = [],      // Files to create before execution
      outputFile,      // File to create
      timeout = 30000
    } = body;

    // Create files if specified
    for (const file of files) {
      const filePath = join(SANDBOX_ROOT, file.path);
      const dir = join(filePath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, file.content);
    }

    // Execute code
    const sandbox = new CodeSandbox({ 
      timeout, 
      allowFetch: true,
      allowFileSystem: true 
    });

    // Validate code
    const validation = sandbox.validateCode(code);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Code validation failed',
        issues: validation.issues
      }, { status: 400 });
    }

    // Execute
    const result = await sandbox.execute(code, inputs);

    // Create output file if specified
    if (outputFile && result.success) {
      const outputPath = join(SANDBOX_ROOT, outputFile);
      writeFileSync(outputPath, JSON.stringify(result.output, null, 2));
    }

    return NextResponse.json({
      success: result.success,
      output: result.output,
      error: result.error,
      logs: result.logs,
      duration: result.duration,
      sandboxPath: SANDBOX_ROOT
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// List sandbox files
export async function GET() {
  const files = readdirSync(SANDBOX_ROOT, { recursive: true });
  return NextResponse.json({
    sandboxPath: SANDBOX_ROOT,
    files: files.map(f => ({
      path: f,
      fullPath: join(SANDBOX_ROOT, f.toString())
    }))
  });
}

// Delete sandbox file
export async function DELETE(request: NextRequest) {
  const { path } = await request.json();
  const fullPath = join(SANDBOX_ROOT, path);
  
  if (existsSync(fullPath)) {
    unlinkSync(fullPath);
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
}
```

### ✅ Checklist Phase 2.1:
- [ ] Create `/api/nexus/execute` route
- [ ] Test code execution
- [ ] Test file creation in sandbox
- [ ] Test file reading from sandbox
- [ ] Add security validations

---

## 2.2 Extend Code Sandbox for File Operations

### Files to Modify:
```
nexus/core/sandbox.ts    [MODIFY]
```

### Key Additions:
1. Add `allowFileSystem` option
2. Add file read/write capabilities
3. Add directory operations
4. Add path validation

### ✅ Checklist Phase 2.2:
- [ ] Add `allowFileSystem` option to sandbox
- [ ] Add `fs` module access in sandbox context
- [ ] Add path validation to prevent escape
- [ ] Test file operations

---

## 2.3 Connect Code Execute to Chat

### Files to Modify:
```
src/app/api/nexus/chat/route.ts    [MODIFY]
src/lib/nexus-bridge.ts            [MODIFY]
```

### Implementation:

Add code_execute tool detection in chat:

```typescript
// In chat route, add tool detection
const CODE_PATTERNS = [
  /```(javascript|typescript|python|js|ts)\n([\s\S]*?)```/g,
  /create (?:a )?(?:file|script|program)/i,
  /execute (?:this )?code/i,
  /run (?:this )?(?:script|code)/i
];

// If code pattern detected, execute it
if (CODE_PATTERNS.some(p => p.test(message))) {
  const codeMatch = message.match(/```(\w+)?\n([\s\S]*?)```/);
  if (codeMatch) {
    const executeResult = await fetch('/api/nexus/execute', {
      method: 'POST',
      body: JSON.stringify({
        code: codeMatch[2],
        language: codeMatch[1] || 'javascript'
      })
    });
    // Include execution result in context
  }
}
```

### ✅ Checklist Phase 2.3:
- [ ] Add code pattern detection
- [ ] Integrate execution with chat flow
- [ ] Display execution results in chat
- [ ] Test code execution from chat

---

# PHASE 3: Web Search Integration
**Priority:** HIGH
**Duration:** 1-2 hours
**Goal:** Implement real web search in agent

## 3.1 Create Web Search API Route

### Files to Create:
```
src/app/api/nexus/search/route.ts    [CREATE]
```

### Implementation:

```typescript
// src/app/api/nexus/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { query, num = 5 } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    const zai = await ZAI.create();
    
    // Use web_search skill
    const searchResult = await zai.functions.invoke('web_search', {
      query,
      num
    });

    return NextResponse.json({
      query,
      results: searchResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Fallback: Use fetch to search API
    try {
      const { query, num = 5 } = await request.json();
      
      // Use DuckDuckGo instant answer API as fallback
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
      );
      const data = await response.json();
      
      return NextResponse.json({
        query,
        results: [{
          title: data.Heading || query,
          snippet: data.AbstractText || data.Answer || 'No summary available',
          url: data.AbstractURL || '',
          source: 'DuckDuckGo'
        }],
        related: data.RelatedTopics?.slice(0, num).map((t: any) => ({
          title: t.Text?.split(' - ')[0] || '',
          snippet: t.Text || '',
          url: t.FirstURL || ''
        })) || [],
        timestamp: new Date().toISOString()
      });
    } catch (fallbackError) {
      return NextResponse.json({
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }
}
```

### ✅ Checklist Phase 3.1:
- [ ] Create `/api/nexus/search` route
- [ ] Test with z-ai-web-dev-sdk
- [ ] Add DuckDuckGo fallback
- [ ] Add result formatting

---

## 3.2 Add Web Search to Conscious Module

### Files to Modify:
```
nexus/core/conscious.ts    [MODIFY]
```

### Already has `handleWebSearch` - enhance it:

```typescript
// Enhance handleWebSearch in conscious.ts
private async handleWebSearch(args: Record<string, unknown>): Promise<unknown> {
  const query = args.query as string;
  const num = (args.num as number) || 5;

  try {
    // Use internal API
    const response = await fetch('http://localhost:3001/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, num })
    });
    
    return await response.json();
  } catch (error) {
    // Direct SDK call
    if (this.zai) {
      const result = await this.zai.functions.invoke('web_search', { query, num });
      return result;
    }
    
    throw new NexusError('TOOL_ERROR', 'Web search unavailable');
  }
}
```

### ✅ Checklist Phase 3.2:
- [ ] Enhance web search handler
- [ ] Add API endpoint integration
- [ ] Test web search from chat
- [ ] Add search result caching

---

# PHASE 4: CLI Autonomous Mode
**Priority:** MEDIUM
**Duration:** 2-3 hours
**Goal:** Add autonomous mode to CLI with background tasks

## 4.1 Create Autonomous Mode Module

### Files to Create:
```
nexus/cli/autonomous.ts    [CREATE]
```

### Implementation:

```typescript
// nexus/cli/autonomous.ts
import { Agent } from '../core/agent';
import { Scheduler } from '../core/scheduler';
import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AutonomousTask {
  id: string;
  type: 'scheduled' | 'reactive' | 'learning';
  action: string;
  interval?: number;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface AutonomousConfig {
  enabled: boolean;
  tasks: AutonomousTask[];
  maxConcurrent: number;
  learningEnabled: boolean;
  selfModificationEnabled: boolean;
}

export class AutonomousMode extends EventEmitter {
  private agent: Agent;
  private scheduler: Scheduler;
  private config: AutonomousConfig;
  private configPath: string;
  private running: boolean = false;

  constructor(agent: Agent, configPath?: string) {
    super();
    this.agent = agent;
    this.scheduler = new Scheduler();
    this.configPath = configPath || join(process.env.HOME || '.', '.nexus', 'autonomous.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): AutonomousConfig {
    if (existsSync(this.configPath)) {
      return JSON.parse(readFileSync(this.configPath, 'utf-8'));
    }
    return {
      enabled: true,
      tasks: [
        {
          id: 'dream-cycle',
          type: 'scheduled',
          action: 'dream',
          interval: 5 * 60 * 1000, // 5 minutes
          enabled: true,
          config: { deep: false }
        },
        {
          id: 'self-reflection',
          type: 'scheduled',
          action: 'reflect',
          interval: 30 * 60 * 1000, // 30 minutes
          enabled: true,
          config: {}
        },
        {
          id: 'memory-cleanup',
          type: 'scheduled',
          action: 'cleanup',
          interval: 60 * 60 * 1000, // 1 hour
          enabled: true,
          config: { maxAge: 7 * 24 * 60 * 60 * 1000 }
        }
      ],
      maxConcurrent: 3,
      learningEnabled: true,
      selfModificationEnabled: false
    };
  }

  private saveConfig(): void {
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.config.enabled = true;
    this.emit('autonomous:started', { timestamp: new Date() });

    // Schedule all tasks
    for (const task of this.config.tasks.filter(t => t.enabled)) {
      this.scheduleTask(task);
    }

    // Start main loop
    this.mainLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.config.enabled = false;
    this.scheduler.stop();
    this.emit('autonomous:stopped', { timestamp: new Date() });
  }

  private scheduleTask(task: AutonomousTask): void {
    if (!task.interval) return;
    
    this.scheduler.schedule({
      id: task.id,
      type: task.action as any,
      cron: `*/${Math.floor(task.interval / 60000)} * * * *`,
      nextRun: new Date(Date.now() + task.interval),
      enabled: task.enabled,
      priority: 'medium',
      config: task.config
    });
  }

  private async mainLoop(): Promise<void> {
    while (this.running) {
      try {
        // Check for scheduled tasks
        const nextTask = this.scheduler.getNextTask();
        
        if (nextTask) {
          await this.executeTask(nextTask);
        }

        // Wait before next iteration
        await this.sleep(1000);
      } catch (error) {
        this.emit('autonomous:error', { error, timestamp: new Date() });
        await this.sleep(5000);
      }
    }
  }

  private async executeTask(task: any): Promise<void> {
    this.emit('autonomous:task_started', { taskId: task.id, timestamp: new Date() });

    try {
      switch (task.type) {
        case 'dream':
          await this.agent.triggerDreamCycle();
          break;
        case 'reflect':
          // Run self-reflection
          const state = this.agent.getState();
          const metrics = this.agent.getMetrics();
          // Analyze and potentially adjust behavior
          break;
        case 'cleanup':
          // Memory cleanup
          break;
        default:
          // Custom task
          await this.agent.executeTask(task.type, task.config);
      }

      this.emit('autonomous:task_completed', { taskId: task.id, timestamp: new Date() });
    } catch (error) {
      this.emit('autonomous:task_failed', { 
        taskId: task.id, 
        error, 
        timestamp: new Date() 
      });
    }
  }

  addTask(task: Omit<AutonomousTask, 'id'>): string {
    const newTask: AutonomousTask = {
      ...task,
      id: crypto.randomUUID()
    };
    this.config.tasks.push(newTask);
    this.saveConfig();
    
    if (this.running && task.enabled) {
      this.scheduleTask(newTask);
    }
    
    return newTask.id;
  }

  removeTask(taskId: string): boolean {
    const index = this.config.tasks.findIndex(t => t.id === taskId);
    if (index >= 0) {
      this.config.tasks.splice(index, 1);
      this.saveConfig();
      this.scheduler.unschedule(taskId);
      return true;
    }
    return false;
  }

  getStatus(): { running: boolean; taskCount: number; config: AutonomousConfig } {
    return {
      running: this.running,
      taskCount: this.config.tasks.length,
      config: this.config
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### ✅ Checklist Phase 4.1:
- [ ] Create AutonomousMode class
- [ ] Implement task scheduling
- [ ] Add dream cycle automation
- [ ] Add self-reflection automation

---

## 4.2 Add Autonomous Commands to CLI

### Files to Modify:
```
nexus/cli/commands.ts    [MODIFY]
nexus/cli/index.ts       [MODIFY]
```

### Add commands:
```typescript
// Add to commands map
'autonomous': {
  description: 'Start autonomous mode',
  handler: async (args, context) => {
    const { AutonomousMode } = await import('./autonomous');
    const agent = await getAgent();
    const autonomous = new AutonomousMode(agent);
    
    await autonomous.start();
    console.log('🤖 Autonomous mode started');
    
    // Keep running
    process.on('SIGINT', async () => {
      await autonomous.stop();
      process.exit(0);
    });
  }
},
'autonomous:status': {
  description: 'Get autonomous mode status',
  handler: async (args, context) => {
    // Show status
  }
},
'autonomous:add': {
  description: 'Add autonomous task',
  handler: async (args, context) => {
    // Add task
  }
}
```

### ✅ Checklist Phase 4.2:
- [ ] Add `nexus autonomous` command
- [ ] Add `nexus autonomous:status` command
- [ ] Add `nexus autonomous:add` command
- [ ] Test autonomous mode

---

# PHASE 5: Build Node Integration
**Priority:** MEDIUM
**Duration:** 2-3 hours
**Goal:** Connect Build Node pipeline to chat

## 5.1 Create Pipeline API Route

### Files to Create:
```
src/app/api/nexus/pipeline/route.ts    [MODIFY - enhance existing]
```

### Enhance existing route:

```typescript
// src/app/api/nexus/pipeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PipelineExecutor } from '@/lib/nexus-bridge';

const executor = new PipelineExecutor();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, pipeline, input, pipelineId } = body;

    switch (action) {
      case 'execute':
        // Register and execute pipeline
        const id = executor.registerPipeline(pipeline);
        const result = await executor.execute(id, { variables: input });
        return NextResponse.json(result);

      case 'executeById':
        const execResult = await executor.execute(pipelineId, { variables: input });
        return NextResponse.json(execResult);

      case 'list':
        return NextResponse.json(executor.listPipelines());

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

### ✅ Checklist Phase 5.1:
- [ ] Enhance pipeline API route
- [ ] Add execute action
- [ ] Add list action
- [ ] Test pipeline execution

---

## 5.2 Add Pipeline Detection to Chat

### Files to Modify:
```
src/app/api/nexus/chat/route.ts    [MODIFY]
```

### Add pipeline execution detection:

```typescript
// Detect pipeline requests
const PIPELINE_PATTERNS = [
  /run (?:the )?pipeline/i,
  /execute (?:the )?(?:workflow|pipeline)/i,
  /start (?:the )?(?:workflow|pipeline)/i
];

if (PIPELINE_PATTERNS.some(p => p.test(message))) {
  // Extract pipeline name/ID
  const pipelineMatch = message.match(/pipeline[:\s]+(\w+)/i);
  if (pipelineMatch) {
    const pipelineResult = await fetch('/api/nexus/pipeline', {
      method: 'POST',
      body: JSON.stringify({
        action: 'executeById',
        pipelineId: pipelineMatch[1],
        input: { query: message }
      })
    });
    // Include result in response
  }
}
```

### ✅ Checklist Phase 5.2:
- [ ] Add pipeline pattern detection
- [ ] Execute pipeline from chat
- [ ] Display pipeline results
- [ ] Test pipeline execution

---

# PHASE 6: Docker Deployment
**Priority:** MEDIUM
**Duration:** 2-3 hours
**Goal:** Create production-ready Docker deployment

## 6.1 Create Docker Compose

### Files to Create:
```
docker-compose.yml    [CREATE]
docker-compose.dev.yml [CREATE]
.env.docker           [CREATE]
```

### Implementation:

```yaml
# docker-compose.yml
version: '3.8'

services:
  nexus-backend:
    build:
      context: ./nexus
      dockerfile: docker/agent-full/Dockerfile
    container_name: nexus-backend
    ports:
      - "3001:3001"
      - "3002:3002"
    environment:
      - NEXUS_HOME=/app/.nexus
      - NEXUS_PRIMARY_MODEL=${NEXUS_PRIMARY_MODEL:-claude-3-5-sonnet}
      - NEXUS_UTILITY_MODEL=${NEXUS_UTILITY_MODEL:-gpt-4o-mini}
      - NODE_ENV=production
    volumes:
      - nexus-data:/app/.nexus
      - nexus-sandbox:/app/sandbox
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  nexus-frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: nexus-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://nexus-backend:3001
      - NEXT_PUBLIC_WS_URL=ws://nexus-backend:3002
    depends_on:
      - nexus-backend
    restart: unless-stopped

  # Optional: Redis for caching
  nexus-redis:
    image: redis:7-alpine
    container_name: nexus-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  # Optional: PostgreSQL for persistent storage
  nexus-db:
    image: postgres:16-alpine
    container_name: nexus-db
    environment:
      - POSTGRES_USER=nexus
      - POSTGRES_PASSWORD=${DB_PASSWORD:-nexus_secret}
      - POSTGRES_DB=nexus
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  nexus-data:
  nexus-sandbox:
  redis-data:
  postgres-data:
```

### ✅ Checklist Phase 6.1:
- [ ] Create docker-compose.yml
- [ ] Create Dockerfile.frontend
- [ ] Test docker-compose up
- [ ] Verify all services

---

## 6.2 Create Frontend Dockerfile

### Files to Create:
```
Dockerfile.frontend    [CREATE]
```

### Implementation:

```dockerfile
# Dockerfile.frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
RUN npm install -g bun && bun install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN bun run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### ✅ Checklist Phase 6.2:
- [ ] Create Dockerfile.frontend
- [ ] Update next.config.ts for standalone output
- [ ] Build frontend image
- [ ] Test frontend container

---

# PHASE 7: Real-time UI Enhancement
**Priority:** HIGH
**Duration:** 2-3 hours
**Goal:** Professional real-time UI with status updates

## 7.1 Create Real-time Status Component

### Files to Create:
```
src/components/nexus/RealTimeStatus.tsx    [CREATE]
src/components/nexus/ActivityFeed.tsx      [CREATE]
src/components/nexus/MetricsPanel.tsx      [CREATE]
```

### Implementation:

```tsx
// src/components/nexus/RealTimeStatus.tsx
'use client';

import { useNexusWebSocket } from '@/hooks/useNexusWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Activity, Zap, Clock, Wifi, WifiOff } from 'lucide-react';

export function RealTimeStatus() {
  const { isConnected, messages, error } = useNexusWebSocket({
    agentId: 'nexus-main',
    autoConnect: true,
    eventTypes: ['status', 'tool_call', 'memory']
  });

  const lastStatus = messages.find(m => m.type === 'status');

  return (
    <Card className="bg-slate-900/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-400" />
          NEXUS Status
        </CardTitle>
        {isConnected ? (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            <Wifi className="h-3 w-3 mr-1" /> Connected
          </Badge>
        ) : (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/30">
            <WifiOff className="h-3 w-3 mr-1" /> Disconnected
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Status indicators */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              <span className="text-slate-400">Status:</span>
              <span className="text-slate-200 capitalize">
                {lastStatus?.payload?.status || 'idle'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-slate-400">Phase:</span>
              <span className="text-slate-200 capitalize">
                {lastStatus?.payload?.phase || 'conscious'}
              </span>
            </div>
          </div>
          
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-400">
                {lastStatus?.payload?.metrics?.tasksCompleted || 0}
              </div>
              <div className="text-xs text-slate-500">Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {lastStatus?.payload?.metrics?.dreamCyclesCompleted || 0}
              </div>
              <div className="text-xs text-slate-500">Dreams</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {((lastStatus?.payload?.metrics?.totalTokensUsed || 0) / 1000).toFixed(1)}k
              </div>
              <div className="text-xs text-slate-500">Tokens</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### ✅ Checklist Phase 7.1:
- [ ] Create RealTimeStatus component
- [ ] Create ActivityFeed component
- [ ] Create MetricsPanel component
- [ ] Test real-time updates

---

## 7.2 Update Main Page with Dashboard

### Files to Modify:
```
src/app/page.tsx    [MODIFY]
```

### Add dashboard layout:

```tsx
// src/app/page.tsx
import { AgentChat } from '@/components/nexus/AgentChat';
import { RealTimeStatus } from '@/components/nexus/RealTimeStatus';
import { ActivityFeed } from '@/components/nexus/ActivityFeed';
import { MetricsPanel } from '@/components/nexus/MetricsPanel';
import { PipelineBuilder } from '@/components/nexus/PipelineBuilder';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-4">
        {/* Left sidebar */}
        <div className="col-span-3 space-y-4">
          <RealTimeStatus />
          <MetricsPanel />
        </div>
        
        {/* Main chat area */}
        <div className="col-span-6">
          <AgentChat />
        </div>
        
        {/* Right sidebar */}
        <div className="col-span-3 space-y-4">
          <ActivityFeed />
          <PipelineBuilder />
        </div>
      </div>
    </div>
  );
}
```

### ✅ Checklist Phase 7.2:
- [ ] Update main page layout
- [ ] Add all dashboard components
- [ ] Test responsive design
- [ ] Test real-time functionality

---

# PHASE 8: Skills Ecosystem
**Priority:** LOW
**Duration:** 2-3 hours
**Goal:** Create skills marketplace and management

## 8.1 Create Skills API

### Files to Create:
```
src/app/api/nexus/skills/route.ts    [CREATE]
src/app/api/nexus/skills/install/route.ts    [CREATE]
```

### ✅ Checklist Phase 8.1:
- [ ] Create skills listing API
- [ ] Create skill installation API
- [ ] Create skill execution API

---

## 8.2 Create Skills UI

### Files to Create:
```
src/components/nexus/SkillsPanel.tsx    [CREATE]
```

### ✅ Checklist Phase 8.2:
- [ ] Create skills panel component
- [ ] Add skill cards
- [ ] Add installation flow

---

# TESTING SCENARIOS

## Test 1: WebSocket Connection
```
1. Start backend: cd nexus && bun run server.ts
2. Start frontend: bun run dev
3. Open browser: http://localhost:3000
4. Check console for WebSocket connection
5. Send message in chat
6. Verify real-time status updates
```

## Test 2: Code Execution
```
1. Send message: "Create a file called test.js with console.log('Hello')"
2. Verify file is created in ~/.nexus/sandbox/test.js
3. Send message: "Execute this code: console.log(2+2)"
4. Verify output shows 4
```

## Test 3: Web Search
```
1. Send message: "Search for latest AI news"
2. Verify search results are returned
3. Verify results are relevant
```

## Test 4: Autonomous Mode
```
1. Run: bun run nexus-cli.ts autonomous
2. Verify dream cycles start
3. Verify self-reflection runs
4. Check logs for activity
```

## Test 5: Docker Deployment
```
1. Run: docker-compose up --build
2. Verify all services start
3. Access http://localhost:3000
4. Test full functionality
```

---

# SUCCESS METRICS

## Performance Targets
| Metric | Target | Current |
|--------|--------|---------|
| WebSocket latency | < 50ms | TBD |
| Chat response time | < 500ms | TBD |
| Code execution | < 5s | TBD |
| Memory usage | < 500MB | TBD |
| Docker startup | < 30s | TBD |

## Feature Parity
| Feature | Agent-Zero | OpenClaw | NEXUS |
|---------|------------|----------|-------|
| Web UI | ✅ | ✅ | ✅ |
| CLI | ✅ | ✅ | ✅ |
| Docker | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ✅ | ✅ |
| Code Execution | ✅ | ✅ | ✅ |
| Web Search | ✅ | ✅ | ✅ |
| Multi-channel | ❌ | ✅ | 🔄 |
| Skills System | ✅ | ✅ | ✅ |
| Self-evolution | ✅ | ❌ | ✅ |
| Vector Memory | ✅ | ❌ | ✅ |
| Dream Cycles | ❌ | ❌ | ✅ |

---

# IMPLEMENTATION ORDER

## Immediate (Today)
1. ✅ Phase 1.1 - WebSocket Connection Fix
2. ✅ Phase 1.2 - Frontend WebSocket Hook Update
3. ✅ Phase 2.1 - Code Execute API

## Short-term (This Week)
4. Phase 3.1 - Web Search Integration
5. Phase 7.1 - Real-time UI
6. Phase 1.3 - Unified Server Script

## Medium-term (Next Week)
7. Phase 4.1 - Autonomous Mode
8. Phase 5.1 - Build Node Integration
9. Phase 6.1 - Docker Compose

## Long-term (Future)
10. Phase 8.1 - Skills Ecosystem
11. Multi-channel support
12. Performance optimization

---

*This plan is ready for implementation. Start with Phase 1.1 for immediate impact.*
