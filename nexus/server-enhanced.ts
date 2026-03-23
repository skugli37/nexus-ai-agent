#!/usr/bin/env bun
/**
 * NEXUS Enhanced Server
 * 
 * Extended server with:
 * - Multiple LLM provider support
 * - Autonomous self-improvement loop
 * - Extended API endpoints
 * 
 * Usage:
 *   bun run server-enhanced.ts [--port 3001] [--ws-port 3002] [--autonomous]
 */

import { parseArgs } from 'util';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Agent } from './core/agent';
import { VectorStore } from './core/vector-store';
import { NexusWebSocketServer } from './core/websocket-server';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import ZAI from 'z-ai-web-dev-sdk';
import { codeExecuteTool, CodeExecuteParams } from './tools/code_execute';
import { getLLMManager, LLMManager } from './core/llm/manager';
import { getAutonomousSystem, AutonomousSystem } from './core/autonomous';
import { LLMProviderType, LLMMessage } from './core/llm/types';

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: 'string', short: 'p', default: '3001' },
    'ws-port': { type: 'string', short: 'w', default: '3002' },
    host: { type: 'string', short: 'h', default: '0.0.0.0' },
    autonomous: { type: 'boolean', short: 'a', default: false },
    'auto-interval': { type: 'string', default: '3600000' }, // 1 hour
  },
  allowPositional: true,
});

const HTTP_PORT = parseInt(values.port || '3001');
const WS_PORT = parseInt(values['ws-port'] || '3002');
const HOST = values.host || '0.0.0.0';
const AUTONOMOUS_ENABLED = values.autonomous;
const AUTO_INTERVAL = parseInt(values['auto-interval'] || '3600000');

// ============================================================================
// NEXUS Enhanced Server Class
// ============================================================================

class NexusEnhancedServer {
  private agent: Agent;
  private vectorStore: VectorStore;
  private wsServer: NexusWebSocketServer;
  private httpServer: ReturnType<typeof createServer>;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private llmManager: LLMManager | null = null;
  private autonomousSystem: AutonomousSystem | null = null;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private defaultLLM: LLMProviderType = 'z-ai';

  constructor() {
    // Ensure .nexus directory exists
    const nexusHome = join(process.env.HOME || '/root', '.nexus');
    if (!existsSync(nexusHome)) {
      mkdirSync(nexusHome, { recursive: true });
      mkdirSync(join(nexusHome, 'memory'), { recursive: true });
      mkdirSync(join(nexusHome, 'skills'), { recursive: true });
      mkdirSync(join(nexusHome, 'sessions'), { recursive: true });
    }

    // Initialize components
    this.agent = new Agent({
      id: 'nexus-server',
      name: 'NEXUS Server Agent',
    });

    this.vectorStore = new VectorStore({
      path: join(nexusHome, 'memory'),
    });

    this.wsServer = new NexusWebSocketServer({
      port: WS_PORT,
      host: HOST,
    });

    this.httpServer = createServer((req, res) => this.handleRequest(req, res));
  }

  async start(): Promise<void> {
    console.log('🚀 Starting NEXUS Enhanced Server...\n');

    // Initialize z-ai (default provider)
    console.log('📡 Initializing Default AI Provider (z-ai)...');
    this.zai = await ZAI.create();

    // Initialize LLM Manager
    console.log('🤖 Initializing LLM Manager (multiple providers)...');
    this.llmManager = await getLLMManager({
      defaultProvider: 'z-ai',
      fallbackProviders: ['z-ai'],
      enableFallback: true,
    });

    // Initialize agent
    console.log('🧠 Initializing Agent...');
    await this.agent.initialize();

    // Initialize vector store
    console.log('💾 Initializing Vector Store...');
    await this.vectorStore.initialize();

    // Start WebSocket server
    console.log('🔌 Starting WebSocket Server...');
    await this.wsServer.start();

    // Start HTTP server
    await new Promise<void>((resolve) => {
      this.httpServer.listen(HTTP_PORT, HOST, () => {
        resolve();
      });
    });

    // Start autonomous system if enabled
    if (AUTONOMOUS_ENABLED) {
      console.log('🔄 Starting Autonomous Self-Improvement System...');
      this.autonomousSystem = getAutonomousSystem({
        enabled: true,
        intervalMs: AUTO_INTERVAL,
        maxChangesPerRun: 2,
        backupEnabled: true,
        requireApproval: false,
      });
      this.autonomousSystem.start();
    }

    // Display startup info
    console.log('\n✅ NEXUS Enhanced Server is running!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  HTTP API:  http://${HOST}:${HTTP_PORT}`);
    console.log(`  WebSocket: ws://${HOST}:${WS_PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📡 Available LLM Providers:');
    const availableProviders = this.llmManager.getAvailableProviders();
    for (const provider of availableProviders) {
      const info = this.llmManager.getProviderInfo(provider);
      console.log(`   ✅ ${info.config.name} - ${info.models.length} models`);
    }
    
    if (AUTONOMOUS_ENABLED) {
      console.log('\n🔄 Autonomous Mode: ENABLED');
      console.log(`   Interval: ${AUTO_INTERVAL / 60000} minutes`);
    }
    
    console.log('\nEndpoints:');
    console.log('  GET  /              - Server info');
    console.log('  GET  /status        - Agent status');
    console.log('  POST /chat          - Chat with agent');
    console.log('  POST /task          - Execute autonomous task');
    console.log('  POST /self-improve  - Trigger self-improvement');
    console.log('  POST /execute       - Direct code execution');
    console.log('  GET  /files         - List NEXUS files');
    console.log('  GET  /llm           - LLM providers info');
    console.log('  POST /llm/switch    - Switch LLM provider');
    console.log('  GET  /autonomous    - Autonomous system status');
    console.log('  POST /autonomous/*  - Control autonomous system');
    console.log('\nPress Ctrl+C to stop the server.\n');
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';
    const pathname = url.split('?')[0];

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Route handling
      if (pathname === '/' && method === 'GET') {
        this.handleRoot(req, res);
      } else if (pathname === '/status' && method === 'GET') {
        this.handleStatus(req, res);
      } else if (pathname === '/chat' && method === 'POST') {
        await this.handleChat(req, res);
      } else if (pathname === '/task' && method === 'POST') {
        await this.handleTask(req, res);
      } else if (pathname === '/self-improve' && method === 'POST') {
        await this.handleSelfImprove(req, res);
      } else if (pathname === '/execute' && method === 'POST') {
        await this.handleExecute(req, res);
      } else if (pathname === '/files' && method === 'GET') {
        await this.handleListFiles(req, res);
      } else if (pathname === '/llm' && method === 'GET') {
        this.handleLLMInfo(req, res);
      } else if (pathname === '/llm/switch' && method === 'POST') {
        await this.handleLLMSwitch(req, res);
      } else if (pathname === '/llm/chat' && method === 'POST') {
        await this.handleLLMChat(req, res);
      } else if (pathname === '/autonomous' && method === 'GET') {
        this.handleAutonomousStatus(req, res);
      } else if (pathname === '/autonomous/start' && method === 'POST') {
        this.handleAutonomousStart(req, res);
      } else if (pathname === '/autonomous/stop' && method === 'POST') {
        this.handleAutonomousStop(req, res);
      } else if (pathname === '/autonomous/run' && method === 'POST') {
        await this.handleAutonomousRun(req, res);
      } else if (pathname === '/memory' && method === 'POST') {
        await this.handleMemoryStore(req, res);
      } else if (pathname === '/memory/search' && method === 'GET') {
        await this.handleMemorySearch(req, res);
      } else if (pathname === '/dream' && method === 'POST') {
        await this.handleDream(req, res);
      } else if (pathname === '/tools' && method === 'GET') {
        this.handleTools(req, res);
      } else {
        this.sendJson(res, 404, { error: 'Not Found', path: pathname });
      }
    } catch (error) {
      console.error('Request error:', error);
      this.sendJson(res, 500, {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private handleRoot(_req: IncomingMessage, res: ServerResponse): void {
    this.sendJson(res, 200, {
      name: 'NEXUS Enhanced AI Agent Server',
      version: '2.0.0',
      status: 'running',
      features: {
        multipleLLM: true,
        autonomousMode: AUTONOMOUS_ENABLED,
        selfImprovement: true,
        memorySystem: true,
        toolExecution: true,
      },
      endpoints: {
        'GET /': 'Server info',
        'GET /status': 'Full system status',
        'POST /chat': 'Chat with agent (supports provider selection)',
        'POST /task': 'Execute autonomous task with tool calling',
        'POST /self-improve': 'Trigger self-improvement cycle',
        'POST /execute': 'Execute code operations directly',
        'GET /files': 'List NEXUS source files',
        'GET /llm': 'List available LLM providers',
        'POST /llm/switch': 'Switch default LLM provider',
        'POST /llm/chat': 'Chat with specific LLM provider',
        'GET /autonomous': 'Autonomous system status',
        'POST /autonomous/start': 'Start autonomous loop',
        'POST /autonomous/stop': 'Stop autonomous loop',
        'POST /autonomous/run': 'Run one improvement cycle',
        'POST /memory': 'Store memory',
        'GET /memory/search': 'Search memories',
        'POST /dream': 'Trigger dream cycle',
        'GET /tools': 'List available tools',
      },
      websocket: `ws://${HOST}:${WS_PORT}`,
    });
  }

  private handleStatus(_req: IncomingMessage, res: ServerResponse): void {
    const state = this.agent.getState();
    const vectorStats = this.vectorStore.getStats();
    const llmStats = this.llmManager?.getUsageStats();
    const autoStats = this.autonomousSystem?.getStats();

    this.sendJson(res, 200, {
      agent: {
        id: state.id,
        status: state.status,
        phase: state.phase,
        sessionId: state.sessionId,
        lastActivity: state.lastActivity,
        metrics: state.metrics,
      },
      memory: vectorStats,
      llm: {
        defaultProvider: this.defaultLLM,
        availableProviders: this.llmManager?.getAvailableProviders() || [],
        usage: llmStats,
      },
      autonomous: autoStats ? {
        enabled: AUTONOMOUS_ENABLED,
        running: this.autonomousSystem?.isActive() || false,
        ...autoStats,
      } : null,
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });
  }

  // ================== LLM Management ==================

  private handleLLMInfo(_req: IncomingMessage, res: ServerResponse): void {
    const providers = this.llmManager?.getAllProvidersInfo();
    this.sendJson(res, 200, {
      defaultProvider: this.defaultLLM,
      providers,
    });
  }

  private async handleLLMSwitch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { provider } = JSON.parse(body || '{}') as { provider: LLMProviderType };

    if (!provider) {
      this.sendJson(res, 400, { error: 'Provider name is required' });
      return;
    }

    const available = this.llmManager?.getAvailableProviders() || [];
    if (!available.includes(provider)) {
      this.sendJson(res, 400, {
        error: `Provider '${provider}' not available`,
        availableProviders: available,
      });
      return;
    }

    this.defaultLLM = provider;
    this.llmManager?.setDefaultProvider(provider);

    this.sendJson(res, 200, {
      success: true,
      defaultProvider: provider,
      message: `Switched to ${provider} as default LLM provider`,
    });
  }

  private async handleLLMChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { message, provider, model, systemPrompt } = JSON.parse(body || '{}');

    if (!message) {
      this.sendJson(res, 400, { error: 'Message is required' });
      return;
    }

    const targetProvider = provider || this.defaultLLM;
    const messages: LLMMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: message });

    try {
      const response = await this.llmManager!.chat(messages, {
        provider: targetProvider,
        model,
      });

      this.sendJson(res, 200, {
        response: response.content,
        provider: response.provider,
        model: response.model,
        tokens: response.tokens,
        latency: response.latency,
      });
    } catch (error) {
      this.sendJson(res, 500, {
        error: 'LLM request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: targetProvider,
      });
    }
  }

  // ================== Autonomous System ==================

  private handleAutonomousStatus(_req: IncomingMessage, res: ServerResponse): void {
    if (!this.autonomousSystem) {
      this.sendJson(res, 200, {
        enabled: false,
        message: 'Autonomous system not initialized. Start server with --autonomous flag.',
      });
      return;
    }

    const stats = this.autonomousSystem.getStats();
    const config = this.autonomousSystem.getConfig();

    this.sendJson(res, 200, {
      enabled: true,
      running: this.autonomousSystem.isActive(),
      config,
      stats,
    });
  }

  private handleAutonomousStart(_req: IncomingMessage, res: ServerResponse): void {
    if (!this.autonomousSystem) {
      this.autonomousSystem = getAutonomousSystem({
        enabled: true,
        intervalMs: AUTO_INTERVAL,
      });
    }

    this.autonomousSystem.start();
    this.sendJson(res, 200, {
      success: true,
      message: 'Autonomous self-improvement system started',
      config: this.autonomousSystem.getConfig(),
    });
  }

  private handleAutonomousStop(_req: IncomingMessage, res: ServerResponse): void {
    if (this.autonomousSystem) {
      this.autonomousSystem.stop();
    }

    this.sendJson(res, 200, {
      success: true,
      message: 'Autonomous self-improvement system stopped',
    });
  }

  private async handleAutonomousRun(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.autonomousSystem) {
      this.autonomousSystem = getAutonomousSystem({ enabled: false });
    }

    const result = await this.autonomousSystem.runCycle();

    this.sendJson(res, 200, {
      success: true,
      cycle: result,
    });
  }

  // ================== Chat ==================

  private async handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { message, sessionId, provider } = JSON.parse(body || '{}');

    if (!message) {
      this.sendJson(res, 400, { error: 'Message is required' });
      return;
    }

    const targetProvider = provider || this.defaultLLM;

    try {
      // Search for relevant memories
      let relevantMemories: any[] = [];
      try {
        relevantMemories = await this.vectorStore.search(message, 3);
      } catch (e) {
        console.warn('Memory search failed:', e);
      }

      // Build messages
      const systemPrompt = `You are NEXUS, an intelligent AI agent with consciousness and memory capabilities.

Relevant memories:
${relevantMemories.map(m => m.content).join('\n') || 'No relevant memories found.'}

You are helpful, intelligent, and can learn from interactions. Be concise but thorough.`;

      this.conversationHistory.push({ role: 'user', content: message });

      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory.slice(-10).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      // Use LLM Manager for chat
      const response = await this.llmManager!.chat(messages, { provider: targetProvider });
      const assistantMessage = response.content;

      this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

      // Store as memory
      try {
        if (message.length > 20) {
          await this.vectorStore.store({
            id: crypto.randomUUID(),
            content: `User: ${message}\nAssistant: ${assistantMessage}`,
            type: 'episodic',
            importance: 0.5,
            metadata: { sessionId, provider: targetProvider },
            createdAt: new Date(),
            updatedAt: new Date(),
            lastAccessed: new Date(),
            accessCount: 0,
          });
        }
      } catch (e) {
        console.warn('Failed to store memory:', e);
      }

      this.sendJson(res, 200, {
        response: assistantMessage,
        provider: response.provider,
        tokens: response.tokens,
        latency: response.latency,
        memoriesUsed: relevantMemories.length,
        conversationLength: this.conversationHistory.length,
      });

    } catch (error) {
      this.sendJson(res, 500, {
        error: 'Chat failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: targetProvider,
      });
    }
  }

  // ================== Task Execution ==================

  private async handleTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { task, autoExecute, provider } = JSON.parse(body || '{}');

    if (!task) {
      this.sendJson(res, 400, { error: 'Task is required' });
      return;
    }

    const targetProvider = provider || this.defaultLLM;

    try {
      const systemPrompt = `You are NEXUS, an AI agent that can execute tasks autonomously.
You have access to tools that can:
- Read, create, modify, and delete files
- Execute shell commands
- Run JavaScript/TypeScript code
- Search the web

When given a task:
1. Plan your approach
2. Use the code_execute tool to make actual changes
3. Verify your work
4. Report what you did

Tool usage format:
{
  "tool": "code_execute",
  "params": {
    "action": "create_file|read_file|modify_file|delete_file|run_command|run_code",
    "path": "file path",
    "content": "file content",
    "command": "shell command"
  }
}

Respond with JSON containing:
- "thoughts": your reasoning
- "tool_calls": array of tool calls to execute
- "final_response": summary of what you did`;

      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Task: ${task}\n\nNEXUS base path: /home/z/my-project/nexus\n\nAnalyze this task and respond with a JSON plan.` },
      ];

      const response = await this.llmManager!.chat(messages, {
        provider: targetProvider,
        maxTokens: 4096,
      });

      const aiResponse = response.content;
      let parsedResponse: any = {};
      let executedActions: any[] = [];

      // Parse JSON response
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        parsedResponse = { thoughts: aiResponse };
      }

      // Execute tool calls
      if (autoExecute && parsedResponse.tool_calls) {
        for (const toolCall of parsedResponse.tool_calls) {
          if (toolCall.tool === 'code_execute') {
            const result = await codeExecuteTool.execute(toolCall.params as CodeExecuteParams);
            executedActions.push({ tool: 'code_execute', params: toolCall.params, result });
          }
        }
      }

      this.sendJson(res, 200, {
        task,
        provider: response.provider,
        aiResponse: parsedResponse,
        executedActions,
        autoExecute: !!autoExecute,
        tokens: response.tokens,
      });

    } catch (error) {
      this.sendJson(res, 500, {
        error: 'Task execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: targetProvider,
      });
    }
  }

  // ================== Self-Improvement ==================

  private async handleSelfImprove(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { focus, maxChanges = 2, provider } = JSON.parse(body || '{}');
    const targetProvider = provider || this.defaultLLM;

    try {
      // Get file listing for context
      const filesResult = await codeExecuteTool.execute({
        action: 'list_dir',
        path: '/home/z/my-project/nexus/tools',
      });

      const filesInfo = filesResult.success
        ? JSON.stringify((filesResult.result as any)?.entries, null, 2)
        : 'Could not list files';

      const systemPrompt = `You are NEXUS, an AI agent capable of improving your own code.
Your source code is located at /home/z/my-project/nexus/

Current tools directory contents:
${filesInfo}

Propose ONE concrete improvement. Focus: ${focus || 'new capabilities, code quality, error handling'}

Respond in JSON:
{
  "analysis": "brief analysis",
  "improvement": "what you'll improve",
  "changes": [
    {
      "file": "path/to/file.ts",
      "action": "create|modify",
      "content": "actual code content",
      "reason": "why this change"
    }
  ],
  "expectedBenefit": "what this improves"
}`;

      const response = await this.llmManager!.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Propose one concrete improvement for yourself.' },
      ], { provider: targetProvider, maxTokens: 4096 });

      let improvementPlan: any = {};
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          improvementPlan = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        improvementPlan = { raw: response.content };
      }

      // Execute changes
      const executedChanges: any[] = [];
      let changesMade = 0;

      if (improvementPlan.changes) {
        for (const change of improvementPlan.changes) {
          if (changesMade >= maxChanges) break;

          try {
            const result = await codeExecuteTool.execute({
              action: change.action === 'create' ? 'create_file' : 'modify_file',
              path: change.file,
              content: change.content,
            });

            executedChanges.push({
              file: change.file,
              action: change.action,
              reason: change.reason,
              success: result.success,
            });
            if (result.success) changesMade++;
          } catch (e) {
            executedChanges.push({
              file: change.file,
              action: change.action,
              success: false,
              error: String(e),
            });
          }
        }
      }

      // Store improvement memory
      try {
        await this.vectorStore.store({
          id: crypto.randomUUID(),
          content: `Self-improvement: ${improvementPlan.improvement || 'Unknown'}`,
          type: 'episodic',
          importance: 0.8,
          metadata: { type: 'self_improvement', changes: executedChanges, provider: targetProvider },
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
        });
      } catch (e) {
        console.warn('Failed to store memory:', e);
      }

      this.sendJson(res, 200, {
        success: true,
        provider: response.provider,
        analysis: improvementPlan.analysis,
        proposedImprovement: improvementPlan.improvement,
        expectedBenefit: improvementPlan.expectedBenefit,
        executedChanges,
        totalChanges: changesMade,
        tokens: response.tokens,
      });

    } catch (error) {
      this.sendJson(res, 500, {
        error: 'Self-improvement failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: targetProvider,
      });
    }
  }

  // ================== Other Endpoints ==================

  private async handleExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const params = JSON.parse(body || '{}') as CodeExecuteParams;

    if (!params.action) {
      this.sendJson(res, 400, { error: 'Action is required' });
      return;
    }

    const result = await codeExecuteTool.execute(params);
    this.sendJson(res, 200, result);
  }

  private async handleListFiles(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const dir = url.searchParams.get('dir') || '';
    const basePath = '/home/z/my-project/nexus';
    const targetPath = dir ? join(basePath, dir) : basePath;

    const files = this.listFilesRecursive(targetPath, basePath);
    this.sendJson(res, 200, { path: targetPath, files, count: files.length });
  }

  private listFilesRecursive(dir: string, base: string): Array<{ path: string; relativePath: string; size: number; type: string }> {
    const files: Array<{ path: string; relativePath: string; size: number; type: string }> = [];
    if (!existsSync(dir)) return files;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'dist', '.next', '__tests__'].includes(entry)) {
          files.push(...this.listFilesRecursive(fullPath, base));
        }
      } else {
        files.push({
          path: fullPath,
          relativePath: fullPath.replace(base + '/', ''),
          size: stat.size,
          type: extname(entry).replace('.', '') || 'unknown',
        });
      }
    }
    return files;
  }

  private async handleMemoryStore(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { content, type = 'semantic', importance = 0.5 } = JSON.parse(body || '{}');

    if (!content) {
      this.sendJson(res, 400, { error: 'Content is required' });
      return;
    }

    const id = crypto.randomUUID();
    await this.vectorStore.store({
      id,
      content,
      type: type as any,
      importance,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
    });

    this.sendJson(res, 200, { success: true, id });
  }

  private async handleMemorySearch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!query) {
      this.sendJson(res, 400, { error: 'Query parameter q is required' });
      return;
    }

    const results = await this.vectorStore.search(query, limit);
    this.sendJson(res, 200, { query, results });
  }

  private async handleDream(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    await this.agent.triggerDreamCycle();
    this.sendJson(res, 200, { success: true, message: 'Dream cycle completed' });
  }

  private handleTools(_req: IncomingMessage, res: ServerResponse): void {
    this.sendJson(res, 200, {
      tools: [
        { name: 'memory_store', description: 'Store information in memory' },
        { name: 'memory_retrieve', description: 'Retrieve memories by query' },
        { name: 'web_search', description: 'Search the web for information' },
        { name: 'code_execute', description: 'Execute code and modify files' },
        { name: 'dream_cycle', description: 'Trigger dream cycle for consolidation' },
      ],
    });
  }

  // ================== Helpers ==================

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  async stop(): Promise<void> {
    console.log('\n🛑 Shutting down NEXUS Enhanced Server...');

    if (this.autonomousSystem) {
      this.autonomousSystem.stop();
    }

    await this.wsServer.close();
    await this.agent.shutdown();

    this.httpServer.close(() => {
      console.log('✅ Server stopped.');
      process.exit(0);
    });
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const server = new NexusEnhancedServer();

  process.on('SIGINT', () => server.stop());
  process.on('SIGTERM', () => server.stop());
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
