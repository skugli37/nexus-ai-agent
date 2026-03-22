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
 * 
 * Inspired by Agent Zero's Docker execution system
 */

import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { CodeSandbox, ExecutionResult as LocalExecutionResult } from './sandbox';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface DockerSandboxConfig {
  baseImage: string;
  memoryLimit: number; // bytes
  cpuLimit: number; // cpu shares (1024 = 1 CPU)
  timeout: number; // ms
  networkEnabled: boolean;
  workDir: string;
  poolSize: number;
  autoCleanup: boolean;
}

export interface ExecutionOptions {
  language: 'javascript' | 'typescript' | 'python' | 'shell' | 'bash' | 'rust' | 'go';
  timeout?: number;
  memoryLimit?: number;
  cpuLimit?: number;
  networkEnabled?: boolean;
  env?: Record<string, string>;
  files?: Record<string, string>;
  stdin?: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
  containerId: string;
  logs: string[];
  stdout: string;
  stderr: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: 'running' | 'exited' | 'error' | 'created';
  image: string;
  createdAt: Date;
  lastUsed: Date;
  executionCount: number;
}

export interface PoolStats {
  total: number;
  available: number;
  inUse: number;
  languages: Record<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: DockerSandboxConfig = {
  baseImage: 'node:20-slim',
  memoryLimit: 128 * 1024 * 1024, // 128MB
  cpuLimit: 512, // 0.5 CPU
  timeout: 30000, // 30 seconds
  networkEnabled: false,
  workDir: '/app',
  poolSize: 5,
  autoCleanup: true
};

const LANGUAGE_CONFIGS: Record<string, {
  image: string;
  extension: string;
  runCommand: string;
  installCommand?: string;
}> = {
  javascript: {
    image: 'node:20-slim',
    extension: 'js',
    runCommand: 'node'
  },
  typescript: {
    image: 'node:20-slim',
    extension: 'ts',
    runCommand: 'npx ts-node',
    installCommand: 'npm install -g typescript ts-node'
  },
  python: {
    image: 'python:3.12-slim',
    extension: 'py',
    runCommand: 'python3'
  },
  shell: {
    image: 'ubuntu:22.04',
    extension: 'sh',
    runCommand: 'bash'
  },
  bash: {
    image: 'ubuntu:22.04',
    extension: 'sh',
    runCommand: 'bash'
  },
  rust: {
    image: 'rust:1.75-slim',
    extension: 'rs',
    runCommand: 'rustc -o /tmp/main && /tmp/main'
  },
  go: {
    image: 'golang:1.21-alpine',
    extension: 'go',
    runCommand: 'go run'
  }
};

// ============================================================================
// Docker Sandbox Implementation
// ============================================================================

export class DockerSandbox extends EventEmitter {
  private config: DockerSandboxConfig;
  private containers: Map<string, ContainerInfo> = new Map();
  private pool: Map<string, string[]> = new Map(); // language -> container IDs
  private initialized: boolean = false;
  private dockerAvailable: boolean = false;
  private localFallback: CodeSandbox;
  private tempDir: string;

  constructor(config: Partial<DockerSandboxConfig> = {}, tempDir: string = '/tmp/nexus-sandbox') {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tempDir = tempDir;
    this.localFallback = new CodeSandbox({
      timeout: this.config.timeout,
      allowFetch: this.config.networkEnabled
    });
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the sandbox and check Docker availability
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[DockerSandbox] Initializing...');

    // Check Docker availability
    this.dockerAvailable = await this.checkDockerAvailability();

    if (this.dockerAvailable) {
      console.log('[DockerSandbox] Docker is available, setting up...');
      
      // Pull required images
      await this.pullRequiredImages();
      
      // Warm up container pool
      await this.warmupPool();
      
      // Setup cleanup handlers
      this.setupCleanupHandlers();
      
      console.log('[DockerSandbox] Docker setup complete');
    } else {
      console.log('[DockerSandbox] Docker not available, using local fallback');
    }

    // Create temp directory
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }

    this.initialized = true;
    this.emit('initialized', { dockerAvailable: this.dockerAvailable });
  }

  /**
   * Check if Docker is available
   */
  private async checkDockerAvailability(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker --version', { timeout: 5000 });
      console.log('[DockerSandbox] Docker version:', stdout.trim());
      
      // Check if Docker daemon is running
      await execAsync('docker info', { timeout: 5000 });
      return true;
    } catch (error) {
      console.warn('[DockerSandbox] Docker not available:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Pull required Docker images
   */
  private async pullRequiredImages(): Promise<void> {
    const images = [...new Set(Object.values(LANGUAGE_CONFIGS).map(c => c.image))];
    
    console.log(`[DockerSandbox] Pulling ${images.length} images...`);
    
    for (const image of images) {
      try {
        await execAsync(`docker pull ${image}`, { timeout: 120000 });
        console.log(`[DockerSandbox] Pulled: ${image}`);
      } catch (error) {
        // Image might already exist
        console.log(`[DockerSandbox] Image ${image} may already exist`);
      }
    }
  }

  /**
   * Warm up container pool for faster execution
   */
  private async warmupPool(): Promise<void> {
    if (!this.dockerAvailable) return;

    console.log(`[DockerSandbox] Warming up pool with ${this.config.poolSize} containers...`);
    
    // Create containers for most common languages
    const languages = ['javascript', 'python', 'shell'];
    
    for (const language of languages) {
      const poolForLang: string[] = [];
      const count = Math.ceil(this.config.poolSize / languages.length);
      
      for (let i = 0; i < count; i++) {
        try {
          const containerId = await this.createPoolContainer(language);
          poolForLang.push(containerId);
        } catch (error) {
          console.warn(`[DockerSandbox] Failed to create pool container for ${language}:`, error);
        }
      }
      
      this.pool.set(language, poolForLang);
    }

    console.log(`[DockerSandbox] Pool ready: ${this.getPoolStats()}`);
  }

  /**
   * Create a container for the pool
   */
  private async createPoolContainer(language: string): Promise<string> {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const containerName = `nexus-pool-${language}-${randomUUID().slice(0, 8)}`;
    
    // Create container
    const createCmd = [
      'docker', 'create',
      '--name', containerName,
      `--memory=${this.config.memoryLimit}`,
      `--memory-swap=${this.config.memoryLimit}`,
      `--cpus=${this.config.cpuLimit / 1024}`,
      `--network=${this.config.networkEnabled ? 'bridge' : 'none'}`,
      `--workdir=${this.config.workDir}`,
      '-i',
      config.image,
      'tail', '-f', '/dev/null'
    ].join(' ');

    const { stdout } = await execAsync(createCmd, { timeout: 30000 });
    const containerId = stdout.trim();

    // Start container
    await execAsync(`docker start ${containerId}`, { timeout: 10000 });

    // Install dependencies if needed
    if (config.installCommand) {
      try {
        await execAsync(`docker exec ${containerId} bash -c "${config.installCommand}"`, { 
          timeout: 60000 
        });
      } catch (error) {
        console.warn(`[DockerSandbox] Failed to install deps for ${language}:`, error);
      }
    }

    // Track container
    this.containers.set(containerId, {
      id: containerId,
      name: containerName,
      status: 'running',
      image: config.image,
      createdAt: new Date(),
      lastUsed: new Date(),
      executionCount: 0
    });

    return containerId;
  }

  /**
   * Setup cleanup handlers for graceful shutdown
   */
  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      console.log('[DockerSandbox] Cleaning up...');
      await this.cleanup();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', () => {
      // Synchronous cleanup on exit
      this.containers.forEach((info, id) => {
        try {
          execSync(`docker rm -f ${id} 2>/dev/null || true`);
        } catch {}
      });
    });
  }

  // ==========================================================================
  // Code Execution
  // ==========================================================================

  /**
   * Execute code in an isolated container
   */
  async execute(code: string, options: ExecutionOptions): Promise<ExecutionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const logs: string[] = [];

    // Validate language
    const config = LANGUAGE_CONFIGS[options.language];
    if (!config) {
      return {
        success: false,
        output: '',
        error: `Unsupported language: ${options.language}. Supported: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`,
        exitCode: 1,
        duration: Date.now() - startTime,
        containerId: 'none',
        logs,
        stdout: '',
        stderr: ''
      };
    }

    // Use Docker if available
    if (this.dockerAvailable) {
      return this.executeInDocker(code, options, config, startTime, logs);
    }

    // Fallback to local execution
    return this.executeLocally(code, options, startTime, logs);
  }

  /**
   * Execute code in Docker container
   */
  private async executeInDocker(
    code: string,
    options: ExecutionOptions,
    config: typeof LANGUAGE_CONFIGS[string],
    startTime: number,
    logs: string[]
  ): Promise<ExecutionResult> {
    let containerId: string | null = null;
    let fromPool = false;

    try {
      // Get container from pool or create new one
      containerId = this.getContainerFromPool(options.language);
      
      if (containerId) {
        fromPool = true;
        logs.push(`Using pooled container: ${containerId.slice(0, 12)}`);
      } else {
        const container = await this.createExecutionContainer(options);
        containerId = container.id;
        logs.push(`Created new container: ${containerId.slice(0, 12)}`);
      }

      // Update container info
      const info = this.containers.get(containerId);
      if (info) {
        info.lastUsed = new Date();
        info.executionCount++;
      }

      const workDir = this.config.workDir;
      const filename = `code.${config.extension}`;

      // Write code to container
      await this.writeFileToContainer(containerId, join(workDir, filename), code);
      logs.push(`Wrote code to ${filename}`);

      // Write additional files
      if (options.files) {
        for (const [fname, content] of Object.entries(options.files)) {
          await this.writeFileToContainer(containerId, join(workDir, fname), content);
          logs.push(`Wrote file: ${fname}`);
        }
      }

      // Build execution command
      const envVars = options.env 
        ? Object.entries(options.env).map(([k, v]) => `${k}='${v}'`).join(' ')
        : '';
      
      const execCmd = `cd ${workDir} && ${envVars} ${config.runCommand} ${filename}`;
      logs.push(`Executing: ${config.runCommand} ${filename}`);

      // Execute with timeout
      const timeout = options.timeout || this.config.timeout;
      const result = await this.executeWithTimeout(
        `docker exec -i ${containerId} bash -c '${execCmd.replace(/'/g, "'\\''")}'`,
        timeout,
        options.stdin
      );

      const duration = Date.now() - startTime;
      logs.push(`Execution completed in ${duration}ms`);

      const execResult: ExecutionResult = {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.exitCode !== 0 ? result.stderr : undefined,
        exitCode: result.exitCode,
        duration,
        containerId,
        logs,
        stdout: result.stdout,
        stderr: result.stderr
      };

      this.emit('execution:complete', execResult);

      // Return container to pool or remove
      if (fromPool && execResult.success && this.config.autoCleanup) {
        await this.cleanupContainer(containerId);
        this.returnContainerToPool(options.language, containerId);
      } else if (!fromPool) {
        await this.removeContainer(containerId);
      }

      return execResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logs.push(`Error: ${errorMessage}`);

      // Cleanup on error
      if (containerId && !fromPool) {
        await this.removeContainer(containerId);
      }

      return {
        success: false,
        output: '',
        error: errorMessage,
        exitCode: 1,
        duration,
        containerId: containerId || 'none',
        logs,
        stdout: '',
        stderr: errorMessage
      };
    }
  }

  /**
   * Execute code locally (fallback)
   */
  private async executeLocally(
    code: string,
    options: ExecutionOptions,
    startTime: number,
    logs: string[]
  ): Promise<ExecutionResult> {
    logs.push('Using local fallback (Docker not available)');

    try {
      const result = await this.localFallback.execute(code, {
        timeout: options.timeout,
        allowFetch: options.networkEnabled
      });

      const duration = Date.now() - startTime;

      return {
        success: result.success,
        output: String(result.output),
        error: result.error,
        exitCode: result.success ? 0 : 1,
        duration,
        containerId: 'local',
        logs: [...logs, ...result.logs],
        stdout: String(result.output),
        stderr: result.error || ''
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration,
        containerId: 'local',
        logs,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // ==========================================================================
  // Container Management
  // ==========================================================================

  /**
   * Get container from pool
   */
  private getContainerFromPool(language: string): string | null {
    const poolForLang = this.pool.get(language);
    if (poolForLang && poolForLang.length > 0) {
      return poolForLang.pop()!;
    }
    return null;
  }

  /**
   * Return container to pool
   */
  private returnContainerToPool(language: string, containerId: string): void {
    const poolForLang = this.pool.get(language) || [];
    poolForLang.push(containerId);
    this.pool.set(language, poolForLang);
  }

  /**
   * Create a new execution container
   */
  private async createExecutionContainer(
    options: ExecutionOptions
  ): Promise<ContainerInfo> {
    const config = LANGUAGE_CONFIGS[options.language];
    const containerName = `nexus-exec-${randomUUID().slice(0, 8)}`;
    const memory = options.memoryLimit || this.config.memoryLimit;
    const cpu = options.cpuLimit || this.config.cpuLimit;
    const network = options.networkEnabled ?? this.config.networkEnabled;

    // Create container
    const createCmd = [
      'docker', 'create',
      '--name', containerName,
      `--memory=${memory}`,
      `--memory-swap=${memory}`,
      `--cpus=${cpu / 1024}`,
      `--network=${network ? 'bridge' : 'none'}`,
      `--workdir=${this.config.workDir}`,
      '-i',
      config.image,
      'tail', '-f', '/dev/null'
    ].join(' ');

    const { stdout } = await execAsync(createCmd, { timeout: 30000 });
    const containerId = stdout.trim();

    // Start container
    await execAsync(`docker start ${containerId}`, { timeout: 10000 });

    // Install dependencies if needed
    if (config.installCommand) {
      try {
        await execAsync(`docker exec ${containerId} bash -c "${config.installCommand}"`, { 
          timeout: 60000 
        });
      } catch {}
    }

    const info: ContainerInfo = {
      id: containerId,
      name: containerName,
      status: 'running',
      image: config.image,
      createdAt: new Date(),
      lastUsed: new Date(),
      executionCount: 0
    };

    this.containers.set(containerId, info);
    this.emit('container:created', info);

    return info;
  }

  /**
   * Write file to container
   */
  private async writeFileToContainer(
    containerId: string,
    path: string,
    content: string
  ): Promise<void> {
    // Escape content for shell
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''")
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');

    await execAsync(
      `docker exec -i ${containerId} bash -c "cat > '${path}' << 'NEXUS_EOF'\n${escaped}\nNEXUS_EOF"`,
      { timeout: 10000 }
    );
  }

  /**
   * Cleanup container for reuse
   */
  private async cleanupContainer(containerId: string): Promise<void> {
    try {
      await execAsync(
        `docker exec ${containerId} bash -c "rm -rf ${this.config.workDir}/*"`,
        { timeout: 5000 }
      );
    } catch {}
  }

  /**
   * Remove a container
   */
  async removeContainer(containerId: string): Promise<void> {
    try {
      await execAsync(`docker stop ${containerId}`, { timeout: 10000 });
    } catch {}
    
    try {
      await execAsync(`docker rm ${containerId}`, { timeout: 10000 });
    } catch {}

    this.containers.delete(containerId);
    
    // Remove from all pools
    for (const [lang, pool] of this.pool) {
      const idx = pool.indexOf(containerId);
      if (idx !== -1) {
        pool.splice(idx, 1);
      }
    }

    this.emit('container:removed', { containerId });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Execute command with timeout and optional stdin
   */
  private async executeWithTimeout(
    command: string,
    timeoutMs: number,
    stdin?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          stdout: '',
          stderr: `Execution timed out after ${timeoutMs}ms`,
          exitCode: 124
        });
      }, timeoutMs);

      const child = spawn(command, [], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
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
        resolve({
          stdout: '',
          stderr: error.message,
          exitCode: 1
        });
      });

      // Send stdin if provided
      if (stdin && child.stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    });
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return language in LANGUAGE_CONFIGS;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_CONFIGS);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): PoolStats {
    const languages: Record<string, number> = {};
    let total = 0;
    let available = 0;

    for (const [lang, pool] of this.pool) {
      languages[lang] = pool.length;
      available += pool.length;
      total += pool.length;
    }

    const inUse = this.containers.size - available;

    return { total, available, inUse, languages };
  }

  /**
   * Check if Docker is available
   */
  isDockerAvailable(): boolean {
    return this.dockerAvailable;
  }

  /**
   * List all containers
   */
  listContainers(): ContainerInfo[] {
    return Array.from(this.containers.values());
  }

  /**
   * Get container by ID
   */
  getContainer(containerId: string): ContainerInfo | undefined {
    return this.containers.get(containerId);
  }

  /**
   * Get container stats (CPU, memory, etc.)
   */
  async getContainerStats(containerId: string): Promise<{
    cpu: number;
    memory: number;
    network: { rx: number; tx: number };
  }> {
    if (!this.dockerAvailable) {
      return { cpu: 0, memory: 0, network: { rx: 0, tx: 0 } };
    }

    try {
      const { stdout } = await execAsync(
        `docker stats ${containerId} --no-stream --format "{{.CPUPerc}},{{.MemPerc}},{{.NetIO}}"`,
        { timeout: 5000 }
      );

      const [cpuStr, memStr, netStr] = stdout.trim().split(',');
      const cpu = parseFloat(cpuStr?.replace('%', '') || '0');
      const memory = parseFloat(memStr?.replace('%', '') || '0');
      
      const [rx, tx] = (netStr || '0 / 0')
        .split('/')
        .map(s => this.parseSize(s.trim()));

      return {
        cpu,
        memory,
        network: { rx: rx || 0, tx: tx || 0 }
      };
    } catch {
      return { cpu: 0, memory: 0, network: { rx: 0, tx: 0 } };
    }
  }

  /**
   * Parse size string (e.g., "1.5GB", "500MB")
   */
  private parseSize(str: string): number {
    const match = str.match(/^([\d.]+)\s*([KMGTP]?B)?$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    
    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 ** 2,
      'GB': 1024 ** 3,
      'TB': 1024 ** 4
    };

    return value * (multipliers[unit] || 1);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Cleanup all containers and resources
   */
  async cleanup(): Promise<void> {
    console.log('[DockerSandbox] Cleaning up all containers...');

    const cleanupPromises: Promise<void>[] = [];

    // Remove all tracked containers
    for (const containerId of this.containers.keys()) {
      cleanupPromises.push(this.removeContainer(containerId));
    }

    // Clear pools
    this.pool.clear();

    await Promise.allSettled(cleanupPromises);

    // Remove temp directory
    try {
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch {}

    this.containers.clear();
    this.emit('cleanup:complete');
    
    console.log('[DockerSandbox] Cleanup complete');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    docker: boolean;
    containers: number;
    poolSize: number;
    languages: string[];
  }> {
    return {
      docker: this.dockerAvailable,
      containers: this.containers.size,
      poolSize: this.getPoolStats().available,
      languages: this.getSupportedLanguages()
    };
  }
}

// Import for sync exec in cleanup handler
import { execSync } from 'child_process';

export default DockerSandbox;
