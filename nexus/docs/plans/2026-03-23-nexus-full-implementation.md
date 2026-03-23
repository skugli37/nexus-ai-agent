# NEXUS Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Kompletna implementacija NEXUS autonomous AI agent-a sa Docker sandbox, Web UI, ClawHub integracijom, i messaging platformama.

**Architecture:**
- TypeScript/Bun backend sa Docker izolacijom
- Next.js 15 Web UI sa shadcn/ui komponentama
- OpenClaw-compatible skill sistem sa ClawHub integracijom
- Agent Zero-style autonomous loop sa tool creation

**Tech Stack:**
- Backend: TypeScript, Bun, Docker SDK, z-ai-web-dev-sdk
- Frontend: Next.js 15, React 19, Tailwind CSS, shadcn/ui
- Database: Prisma sa SQLite/PostgreSQL
- Messaging: WhatsApp Web.js, Telegram Bot API
- Infrastructure: Docker containers, WebSocket real-time

---

## Task 1: Docker Sandbox - Izolovano izvršavanje koda

**Files:**
- Create: `nexus/core/docker-sandbox.ts`
- Create: `nexus/core/__tests__/docker-sandbox.test.ts`
- Modify: `nexus/core/index.ts`

**Step 1: Write the failing test**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DockerSandbox } from '../docker-sandbox';

describe('DockerSandbox', () => {
  let sandbox: DockerSandbox;

  beforeAll(async () => {
    sandbox = new DockerSandbox();
    await sandbox.initialize();
  });

  afterAll(async () => {
    await sandbox.cleanup();
  });

  test('should create isolated container', async () => {
    const container = await sandbox.createContainer({ image: 'node:20-slim' });
    expect(container.id).toBeDefined();
    expect(container.status).toBe('running');
  });

  test('should execute code in container', async () => {
    const result = await sandbox.execute('console.log("Hello Docker")', {
      language: 'javascript',
      timeout: 5000
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello Docker');
  });

  test('should handle timeout correctly', async () => {
    const result = await sandbox.execute('while(true) {}', {
      language: 'javascript',
      timeout: 1000
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });

  test('should isolate filesystem', async () => {
    await sandbox.execute('fs.writeFileSync("/tmp/test.txt", "data")', { language: 'javascript' });
    const result = await sandbox.execute('fs.existsSync("/tmp/test.txt")', { language: 'javascript' });
    // New container should not have the file
    expect(result.output).toContain('false');
  });

  test('should support Python execution', async () => {
    const result = await sandbox.execute('print("Hello Python")', {
      language: 'python',
      timeout: 5000
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello Python');
  });

  test('should support Shell execution', async () => {
    const result = await sandbox.execute('echo "Hello Shell"', {
      language: 'shell',
      timeout: 5000
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello Shell');
  });

  test('should limit memory usage', async () => {
    const result = await sandbox.execute(`
      const arr = [];
      for(let i = 0; i < 10000000; i++) arr.push(new Array(1000));
    `, {
      language: 'javascript',
      memoryLimit: 64 * 1024 * 1024 // 64MB
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/memory|OOM/);
  });

  test('should support multiple languages', async () => {
    const languages = ['javascript', 'python', 'shell', 'typescript'];
    for (const lang of languages) {
      const supported = await sandbox.isLanguageSupported(lang);
      expect(supported).toBe(true);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd nexus && bun test core/__tests__/docker-sandbox.test.ts`
Expected: FAIL with "Cannot find module '../docker-sandbox'"

**Step 3: Write the implementation**

```typescript
/**
 * NEXUS Docker Sandbox
 * Provides isolated code execution using Docker containers
 * 
 * Features:
 * - Multi-language support (JS, TS, Python, Shell)
 * - Memory and CPU limits
 * - Timeout control
 * - Filesystem isolation
 * - Network isolation (optional)
 * - Container pooling for performance
 */

import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

export interface DockerSandboxConfig {
  baseImage: string;
  memoryLimit: number; // bytes
  cpuLimit: number; // cpu shares
  timeout: number; // ms
  networkEnabled: boolean;
  workDir: string;
}

export interface ExecutionOptions {
  language: 'javascript' | 'typescript' | 'python' | 'shell' | 'bash';
  timeout?: number;
  memoryLimit?: number;
  cpuLimit?: number;
  networkEnabled?: boolean;
  env?: Record<string, string>;
  files?: Record<string, string>; // filename -> content
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
  containerId: string;
  logs: string[];
}

export interface ContainerInfo {
  id: string;
  status: 'running' | 'exited' | 'error';
  image: string;
  createdAt: Date;
}

const DEFAULT_CONFIG: DockerSandboxConfig = {
  baseImage: 'node:20-slim',
  memoryLimit: 128 * 1024 * 1024, // 128MB
  cpuLimit: 512, // 0.5 CPU
  timeout: 30000, // 30 seconds
  networkEnabled: false,
  workDir: '/app'
};

const LANGUAGE_IMAGES: Record<string, string> = {
  javascript: 'node:20-slim',
  typescript: 'node:20-slim',
  python: 'python:3.12-slim',
  shell: 'ubuntu:22.04',
  bash: 'ubuntu:22.04'
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  shell: 'sh',
  bash: 'sh'
};

const LANGUAGE_RUN_COMMANDS: Record<string, string> = {
  javascript: 'node',
  typescript: 'npx ts-node',
  python: 'python3',
  shell: 'bash',
  bash: 'bash'
};

export class DockerSandbox extends EventEmitter {
  private config: DockerSandboxConfig;
  private containers: Map<string, ContainerInfo> = new Map();
  private pool: string[] = []; // Container pool for reuse
  private initialized: boolean = false;
  private dockerAvailable: boolean = false;

  constructor(config: Partial<DockerSandboxConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the sandbox and check Docker availability
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { stdout } = await execAsync('docker --version');
      this.dockerAvailable = true;
      console.log('Docker available:', stdout.trim());

      // Pull required images
      await this.pullRequiredImages();

      // Pre-warm container pool
      await this.warmupPool(3);

      this.initialized = true;
      this.emit('initialized', { dockerVersion: stdout.trim() });
    } catch (error) {
      console.warn('Docker not available, falling back to local execution');
      this.dockerAvailable = false;
      this.initialized = true;
    }
  }

  /**
   * Pull required Docker images
   */
  private async pullRequiredImages(): Promise<void> {
    const images = [...new Set(Object.values(LANGUAGE_IMAGES))];
    
    for (const image of images) {
      try {
        await execAsync(`docker pull ${image}`);
        console.log(`Pulled image: ${image}`);
      } catch (error) {
        console.warn(`Failed to pull image ${image}, may already exist`);
      }
    }
  }

  /**
   * Warm up container pool for faster execution
   */
  private async warmupPool(count: number): Promise<void> {
    if (!this.dockerAvailable) return;

    for (let i = 0; i < count; i++) {
      try {
        const containerId = await this.createPoolContainer();
        this.pool.push(containerId);
      } catch (error) {
        console.warn('Failed to create pool container:', error);
      }
    }
  }

  /**
   * Create a container for the pool
   */
  private async createPoolContainer(): Promise<string> {
    const containerName = `nexus-pool-${randomUUID().slice(0, 8)}`;
    
    const { stdout } = await execAsync(
      `docker create --name ${containerName} ` +
      `--memory=${this.config.memoryLimit} ` +
      `--cpus=${this.config.cpuLimit / 1024} ` +
      `--network=${this.config.networkEnabled ? 'bridge' : 'none'} ` +
      `--workdir=${this.config.workDir} ` +
      `-i ${this.config.baseImage} tail -f /dev/null`
    );

    const containerId = stdout.trim();
    
    await execAsync(`docker start ${containerId}`);

    this.containers.set(containerId, {
      id: containerId,
      status: 'running',
      image: this.config.baseImage,
      createdAt: new Date()
    });

    return containerId;
  }

  /**
   * Create a new isolated container
   */
  async createContainer(options: {
    image?: string;
    memoryLimit?: number;
    cpuLimit?: number;
    networkEnabled?: boolean;
  } = {}): Promise<ContainerInfo> {
    if (!this.dockerAvailable) {
      throw new Error('Docker is not available');
    }

    const image = options.image || this.config.baseImage;
    const containerName = `nexus-${randomUUID().slice(0, 8)}`;
    const memory = options.memoryLimit || this.config.memoryLimit;
    const cpu = options.cpuLimit || this.config.cpuLimit;
    const network = options.networkEnabled ?? this.config.networkEnabled;

    const { stdout } = await execAsync(
      `docker create --name ${containerName} ` +
      `--memory=${memory} ` +
      `--cpus=${cpu / 1024} ` +
      `--network=${network ? 'bridge' : 'none'} ` +
      `--workdir=${this.config.workDir} ` +
      `-i ${image} tail -f /dev/null`
    );

    const containerId = stdout.trim();

    await execAsync(`docker start ${containerId}`);

    const info: ContainerInfo = {
      id: containerId,
      status: 'running',
      image,
      createdAt: new Date()
    };

    this.containers.set(containerId, info);
    this.emit('container:created', info);

    return info;
  }

  /**
   * Execute code in a container
   */
  async execute(code: string, options: ExecutionOptions): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    // Check if Docker is available
    if (!this.dockerAvailable) {
      return this.executeLocal(code, options, startTime);
    }

    let containerId: string;
    let fromPool = false;

    // Try to get container from pool
    if (this.pool.length > 0) {
      containerId = this.pool.pop()!;
      fromPool = true;
    } else {
      const container = await this.createContainer({
        image: LANGUAGE_IMAGES[options.language] || this.config.baseImage,
        memoryLimit: options.memoryLimit,
        cpuLimit: options.cpuLimit,
        networkEnabled: options.networkEnabled
      });
      containerId = container.id;
    }

    try {
      const ext = LANGUAGE_EXTENSIONS[options.language] || 'txt';
      const filename = `code.${ext}`;
      const workDir = this.config.workDir;

      // Write code to container
      const escapedCode = code.replace(/'/g, "'\\''");
      await execAsync(
        `docker exec ${containerId} bash -c "echo '${escapedCode}' > ${workDir}/${filename}"`
      );

      // Write additional files
      if (options.files) {
        for (const [fname, content] of Object.entries(options.files)) {
          const escaped = content.replace(/'/g, "'\\''");
          await execAsync(
            `docker exec ${containerId} bash -c "echo '${escaped}' > ${workDir}/${fname}"`
          );
        }
      }

      // Build run command
      const runCmd = LANGUAGE_RUN_COMMANDS[options.language] || 'node';
      const timeout = options.timeout || this.config.timeout;

      // Execute with timeout
      const result = await this.executeWithTimeout(
        `docker exec ${containerId} bash -c "cd ${workDir} && ${runCmd} ${filename}"`,
        timeout
      );

      const duration = Date.now() - startTime;

      const execResult: ExecutionResult = {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.exitCode !== 0 ? result.stderr : undefined,
        exitCode: result.exitCode,
        duration,
        containerId,
        logs
      };

      this.emit('execution:complete', execResult);

      // Return container to pool or remove
      if (fromPool && execResult.success) {
        // Clean up for reuse
        await execAsync(`docker exec ${containerId} bash -c "rm -rf ${workDir}/*"`);
        this.pool.push(containerId);
      } else {
        await this.removeContainer(containerId);
      }

      return execResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.removeContainer(containerId);

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration,
        containerId,
        logs
      };
    }
  }

  /**
   * Execute command with timeout
   */
  private async executeWithTimeout(
    command: string,
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve({
          stdout: '',
          stderr: `Execution timed out after ${timeoutMs}ms`,
          exitCode: 124
        });
      }, timeoutMs);

      const child = spawn(command, [], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Execute code locally (fallback when Docker not available)
   */
  private async executeLocal(
    code: string,
    options: ExecutionOptions,
    startTime: number
  ): Promise<ExecutionResult> {
    const { CodeSandbox } = await import('./sandbox');
    const localSandbox = new CodeSandbox({
      timeout: options.timeout,
      allowFetch: options.networkEnabled
    });

    const result = await localSandbox.execute(code, {
      env: options.env
    });

    return {
      success: result.success,
      output: String(result.output),
      error: result.error,
      exitCode: result.success ? 0 : 1,
      duration: Date.now() - startTime,
      containerId: 'local',
      logs: result.logs
    };
  }

  /**
   * Remove a container
   */
  async removeContainer(containerId: string): Promise<void> {
    try {
      await execAsync(`docker stop ${containerId}`);
      await execAsync(`docker rm ${containerId}`);
      this.containers.delete(containerId);
      this.pool = this.pool.filter(id => id !== containerId);
      this.emit('container:removed', { containerId });
    } catch (error) {
      console.warn('Failed to remove container:', error);
    }
  }

  /**
   * Check if language is supported
   */
  async isLanguageSupported(language: string): Promise<boolean> {
    return language in LANGUAGE_IMAGES;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_IMAGES);
  }

  /**
   * Get container stats
   */
  async getContainerStats(containerId: string): Promise<{
    cpu: number;
    memory: number;
    network: { rx: number; tx: number };
  }> {
    try {
      const { stdout } = await execAsync(
        `docker stats ${containerId} --no-stream --format "{{.CPUPerc}},{{.MemUsage}}"`
      );
      
      const [cpuStr, memStr] = stdout.trim().split(',');
      const cpu = parseFloat(cpuStr.replace('%', ''));
      const memMatch = memStr.match(/(\d+\.?\d*)MiB/);
      const memory = memMatch ? parseFloat(memMatch[1]) : 0;

      return {
        cpu,
        memory: memory * 1024 * 1024, // Convert to bytes
        network: { rx: 0, tx: 0 }
      };
    } catch {
      return { cpu: 0, memory: 0, network: { rx: 0, tx: 0 } };
    }
  }

  /**
   * List all containers
   */
  listContainers(): ContainerInfo[] {
    return Array.from(this.containers.values());
  }

  /**
   * Cleanup all containers
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = [];

    // Remove all tracked containers
    for (const containerId of this.containers.keys()) {
      cleanupPromises.push(this.removeContainer(containerId));
    }

    // Clear pool
    this.pool = [];

    await Promise.allSettled(cleanupPromises);
    
    this.containers.clear();
    this.emit('cleanup:complete');
  }

  /**
   * Check if Docker is available
   */
  isDockerAvailable(): boolean {
    return this.dockerAvailable;
  }

  /**
   * Get pool status
   */
  getPoolStatus(): { total: number; available: number; inUse: number } {
    return {
      total: this.pool.length + (this.containers.size - this.pool.length),
      available: this.pool.length,
      inUse: this.containers.size - this.pool.length
    };
  }
}

export default DockerSandbox;
```

**Step 4: Run test to verify it passes**

Run: `cd nexus && bun test core/__tests__/docker-sandbox.test.ts`
Expected: PASS (or skip if Docker not available)

**Step 5: Commit**

```bash
git add core/docker-sandbox.ts core/__tests__/docker-sandbox.test.ts core/index.ts
git commit -m "feat: add Docker sandbox for isolated code execution"
```

---

## Task 2: Web UI - Next.js Dashboard

**Files:**
- Create: `nexus/web/app/layout.tsx`
- Create: `nexus/web/app/page.tsx`
- Create: `nexus/web/app/chat/page.tsx`
- Create: `nexus/web/components/ChatInterface.tsx`
- Create: `nexus/web/components/AgentStatus.tsx`
- Create: `nexus/web/components/MemoryPanel.tsx`
- Create: `nexus/web/components/ToolPanel.tsx`
- Create: `nexus/web/lib/api.ts`
- Create: `nexus/web/package.json`

**Implementation: Full React/Next.js UI with real-time chat, agent status, memory visualization, and tool management.**

---

## Task 3: ClawHub Integration - Skill Registry

**Files:**
- Create: `nexus/core/clawhub.ts`
- Create: `nexus/core/__tests__/clawhub.test.ts`

**Implementation: API client for ClawHub skill registry with search, download, and install capabilities.**

---

## Task 4: Messaging Platforms - WhatsApp/Telegram

**Files:**
- Create: `nexus/messaging/whatsapp.ts`
- Create: `nexus/messaging/telegram.ts`
- Create: `nexus/messaging/index.ts`

**Implementation: WhatsApp Web.js and Telegram Bot API integrations.**

---

## Task 5: Enhanced Build Node System

**Files:**
- Modify: `nexus/cli/build-node.ts`
- Create: `nexus/core/pipeline-executor.ts`

**Implementation: Enhanced pipeline with parallel execution, conditionals, and loops.**

---

## Task 6: Full Test Suite

**Files:**
- Create: `nexus/core/__tests__/docker-sandbox.test.ts`
- Create: `nexus/core/__tests__/clawhub.test.ts`
- Create: `nexus/messaging/__tests__/whatsapp.test.ts`
- Create: `nexus/messaging/__tests__/telegram.test.ts`

**Implementation: Comprehensive tests for all components.**
