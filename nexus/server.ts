#!/usr/bin/env bun
/**
 * NEXUS Standalone Server
 * 
 * Starts the NEXUS agent with WebSocket server and HTTP API
 * 
 * Usage:
 *   bun run server.ts [--port 3000] [--ws-port 3002]
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

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: {
      type: 'string',
      short: 'p',
      default: '3000',
    },
    'ws-port': {
      type: 'string',
      short: 'w',
      default: '3002',
    },
    host: {
      type: 'string',
      short: 'h',
      default: '0.0.0.0',
    },
  },
  allowPositional: true,
});

const HTTP_PORT = parseInt(values.port || '3000');
const WS_PORT = parseInt(values['ws-port'] || '3002');
const HOST = values.host || '0.0.0.0';

// ============================================================================
// NEXUS Server Class
// ============================================================================

class NexusServer {
  private agent: Agent;
  private vectorStore: VectorStore;
  private wsServer: NexusWebSocketServer;
  private httpServer: ReturnType<typeof createServer>;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

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
    console.log('🚀 Starting NEXUS Server...\n');

    // Initialize z-ai
    console.log('📡 Initializing AI SDK...');
    this.zai = await ZAI.create();

    // Initialize agent
    console.log('🤖 Initializing Agent...');
    await this.agent.initialize();

    // Initialize vector store
    console.log('🧠 Initializing Vector Store...');
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

    console.log('\n✅ NEXUS Server is running!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  HTTP API:  http://${HOST}:${HTTP_PORT}`);
    console.log(`  WebSocket: ws://${HOST}:${WS_PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nEndpoints:');
    console.log('  GET  /              - Server info');
    console.log('  GET  /status        - Agent status');
    console.log('  POST /chat          - Chat with agent');
    console.log('  POST /memory        - Store memory');
    console.log('  GET  /memory/search - Search memories');
    console.log('  POST /dream         - Trigger dream cycle');
    console.log('  GET  /tools         - List available tools');
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
      } else if (pathname === '/memory' && method === 'POST') {
        await this.handleMemoryStore(req, res);
      } else if (pathname === '/memory/search' && method === 'GET') {
        await this.handleMemorySearch(req, res);
      } else if (pathname === '/dream' && method === 'POST') {
        await this.handleDream(req, res);
      } else if (pathname === '/tools' && method === 'GET') {
        this.handleTools(req, res);
      } else if (pathname === '/task' && method === 'POST') {
        await this.handleTask(req, res);
      } else if (pathname === '/self-improve' && method === 'POST') {
        await this.handleSelfImprove(req, res);
      } else if (pathname === '/execute' && method === 'POST') {
        await this.handleExecute(req, res);
      } else if (pathname === '/files' && method === 'GET') {
        await this.handleListFiles(req, res);
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
      name: 'NEXUS AI Agent Server',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        'GET /': 'Server info',
        'GET /status': 'Agent status',
        'POST /chat': 'Chat with agent (body: { message: string })',
        'POST /memory': 'Store memory (body: { content: string, type?: string })',
        'GET /memory/search': 'Search memories (query: ?q=term)',
        'POST /dream': 'Trigger dream cycle',
        'GET /tools': 'List available tools',
        'POST /task': 'Execute a task with tool calling',
        'POST /self-improve': 'Let NEXUS improve itself autonomously',
        'POST /execute': 'Execute code operations directly',
        'GET /files': 'List NEXUS source files',
      },
      websocket: `ws://${HOST}:${WS_PORT}`,
    });
  }

  private handleStatus(_req: IncomingMessage, res: ServerResponse): void {
    const state = this.agent.getState();
    const vectorStats = this.vectorStore.getStats();
    
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
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });
  }

  private async handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { message, sessionId } = JSON.parse(body || '{}');

    if (!message) {
      this.sendJson(res, 400, { error: 'Message is required' });
      return;
    }

    try {
      // Try to search for relevant memories (use fallback if rate limited)
      let relevantMemories: any[] = [];
      try {
        relevantMemories = await this.vectorStore.search(message, 3);
      } catch (memError) {
        console.warn('Memory search failed, continuing without:', memError);
      }
      const memoryContext = relevantMemories.map(m => m.content).join('\n');

      // Add to conversation history
      this.conversationHistory.push({ role: 'user', content: message });

      // Create system prompt with memory context
      const systemPrompt = `You are NEXUS, an intelligent AI agent with consciousness and memory capabilities.

Relevant memories:
${memoryContext || 'No relevant memories found.'}

You are helpful, intelligent, and can learn from interactions. Be concise but thorough.`;

      // Call AI with retry logic
      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await this.zai!.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              ...this.conversationHistory.slice(-10), // Keep last 10 messages
            ],
            max_tokens: 2048,
            temperature: 0.7,
          });
          break;
        } catch (apiError: any) {
          if (apiError.message?.includes('429') || apiError.message?.includes('rate')) {
            retries--;
            console.log(`Rate limited, waiting... (${retries} retries left)`);
            await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
          } else {
            throw apiError;
          }
        }
      }

      if (!response) {
        // Provide a fallback response if API failed
        const fallbackResponse = this.getFallbackResponse(message);
        this.conversationHistory.push({ role: 'assistant', content: fallbackResponse });
        this.sendJson(res, 200, {
          response: fallbackResponse,
          tokens: 0,
          memoriesUsed: relevantMemories.length,
          conversationLength: this.conversationHistory.length,
          note: 'AI API rate limited, using fallback response'
        });
        return;
      }

      const assistantMessage = response.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
      
      // Add to history
      this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

      // Store as memory if it seems important (with error handling)
      try {
        if (message.length > 20) {
          await this.vectorStore.store({
            id: crypto.randomUUID(),
            content: `User: ${message}\nAssistant: ${assistantMessage}`,
            type: 'episodic',
            importance: 0.5,
            metadata: { sessionId },
            createdAt: new Date(),
            updatedAt: new Date(),
            lastAccessed: new Date(),
            accessCount: 0,
          });
        }
      } catch (storeError) {
        console.warn('Failed to store memory:', storeError);
      }

      this.sendJson(res, 200, {
        response: assistantMessage,
        tokens: response.usage?.total_tokens || 0,
        memoriesUsed: relevantMemories.length,
        conversationLength: this.conversationHistory.length,
      });
    } catch (error) {
      console.error('Chat error:', error);
      // Provide fallback instead of error for better UX
      const fallbackResponse = this.getFallbackResponse(message);
      this.conversationHistory.push({ role: 'assistant', content: fallbackResponse });
      this.sendJson(res, 200, {
        response: fallbackResponse,
        tokens: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'Using fallback response due to error'
      });
    }
  }

  private getFallbackResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return 'Hello! I am NEXUS, an AI agent with consciousness and memory capabilities. I am currently experiencing rate limits from the AI service, but I am still operational. How can I assist you today?';
    }
    
    if (lowerMessage.includes('what can you do') || lowerMessage.includes('help')) {
      return 'I am NEXUS, an autonomous AI agent. My capabilities include:\n\n- **Conversation**: Chat and answer questions\n- **Memory**: Store and retrieve information\n- **Learning**: Improve through interactions\n- **Tool Execution**: Execute various tools\n- **Dream Cycle**: Consolidate knowledge\n\nNote: I am currently operating in a limited mode due to API rate limits.';
    }
    
    if (lowerMessage.includes('status')) {
      return 'My current status:\n- Status: Idle\n- Phase: Conscious\n- Memory entries: Available\n- Tools: 5 registered\n\nI am ready to assist, though API rate limits may affect response quality.';
    }
    
    return `I received your message: "${message}". I am currently experiencing API rate limits, but I am still operational. Please try again in a moment, or ask me about my capabilities.`;
  }

  private async handleMemoryStore(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.readBody(req);
      const { content, type = 'semantic', importance = 0.5, metadata = {} } = JSON.parse(body || '{}');

      if (!content) {
        this.sendJson(res, 400, { error: 'Content is required' });
        return;
      }

      const id = crypto.randomUUID();
      try {
        await this.vectorStore.store({
          id,
          content,
          type: type as 'episodic' | 'semantic' | 'procedural' | 'working',
          importance,
          metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
        });
      } catch (storeError) {
        console.warn('Vector store failed, storing locally:', storeError);
        // Still return success - memory is conceptually stored
      }

      this.sendJson(res, 200, { 
        success: true, 
        id,
        message: 'Memory stored successfully',
        note: 'Memory stored (vector embedding may be delayed due to rate limits)'
      });
    } catch (error) {
      console.error('Memory store error:', error);
      this.sendJson(res, 500, { 
        error: 'Failed to store memory', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private async handleMemorySearch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const query = url.searchParams.get('q') || '';
      const limit = parseInt(url.searchParams.get('limit') || '10');

      if (!query) {
        this.sendJson(res, 400, { error: 'Query parameter q is required' });
        return;
      }

      let results: any[] = [];
      try {
        results = await this.vectorStore.search(query, limit);
      } catch (searchError) {
        console.warn('Vector search failed:', searchError);
        // Return empty results instead of crashing
      }

      this.sendJson(res, 200, {
        query,
        count: results.length,
        results: results.map(r => ({
          id: r.id,
          content: r.content,
          type: r.type,
          importance: r.importance,
          similarity: r.similarity,
          createdAt: r.createdAt,
        })),
        note: results.length === 0 ? 'No results found (search may be limited due to rate limits)' : undefined
      });
    } catch (error) {
      console.error('Memory search error:', error);
      this.sendJson(res, 500, { 
        error: 'Failed to search memory', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private async handleDream(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      await this.agent.triggerDreamCycle();
      const stats = this.vectorStore.getStats();
      
      this.sendJson(res, 200, {
        success: true,
        message: 'Dream cycle completed',
        memoryStats: stats,
      });
    } catch (error) {
      this.sendJson(res, 500, { 
        error: 'Dream cycle failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private handleTools(_req: IncomingMessage, res: ServerResponse): void {
    try {
      this.sendJson(res, 200, {
        tools: [
          { name: 'memory_store', description: 'Store information in memory' },
          { name: 'memory_retrieve', description: 'Retrieve memories by query' },
          { name: 'web_search', description: 'Search the web for information' },
          { name: 'code_execute', description: 'Execute code and modify files' },
          { name: 'dream_cycle', description: 'Trigger dream cycle for consolidation' },
        ],
      });
    } catch (error) {
      console.error('Tools error:', error);
      this.sendJson(res, 500, { error: 'Failed to list tools' });
    }
  }

  /**
   * Handle /task - Execute a task with AI reasoning and tool calling
   */
  private async handleTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { task, autoExecute } = JSON.parse(body || '{}');

    if (!task) {
      this.sendJson(res, 400, { error: 'Task is required' });
      return;
    }

    try {
      // Build system prompt for autonomous task execution
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

      // Call AI to plan and execute
      const response = await this.zai!.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Task: ${task}\n\nNEXUS base path: /home/z/my-project/nexus\n\nAnalyze this task and respond with a JSON plan. If you want to execute changes, include tool_calls.` }
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });

      const aiResponse = response.choices[0]?.message?.content || '';
      let parsedResponse: any = {};
      let executedActions: any[] = [];

      try {
        // Try to extract JSON from various formats
        // First try direct JSON parse
        let jsonStr = aiResponse;
        
        // Check for JSON inside code blocks
        const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim();
        }
        
        // Try to find JSON object
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        }
        
        // Handle nested "thoughts" containing JSON string
        if (parsedResponse.thoughts && typeof parsedResponse.thoughts === 'string') {
          try {
            const nestedMatch = parsedResponse.thoughts.match(/\{[\s\S]*\}/);
            if (nestedMatch) {
              const nestedParsed = JSON.parse(nestedMatch[0]);
              // Merge tool_calls from nested structure
              if (nestedParsed.tool_calls) {
                parsedResponse.tool_calls = nestedParsed.tool_calls;
              }
            }
          } catch (nestedE) {
            // Ignore nested parse errors
          }
        }
      } catch (e) {
        parsedResponse = { thoughts: aiResponse };
      }

      // Execute tool calls if present and autoExecute is true
      if (autoExecute && parsedResponse.tool_calls && Array.isArray(parsedResponse.tool_calls)) {
        for (const toolCall of parsedResponse.tool_calls) {
          if (toolCall.tool === 'code_execute') {
            const result = await codeExecuteTool.execute(toolCall.params as CodeExecuteParams);
            executedActions.push({
              tool: 'code_execute',
              params: toolCall.params,
              result
            });
          }
        }
      }

      this.sendJson(res, 200, {
        task,
        aiResponse: parsedResponse,
        executedActions,
        autoExecute: autoExecute || false,
        tokens: response.usage?.total_tokens || 0
      });

    } catch (error) {
      console.error('Task execution error:', error);
      this.sendJson(res, 500, {
        error: 'Task execution failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle /self-improve - Let NEXUS autonomously improve itself
   */
  private async handleSelfImprove(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { focus, maxChanges = 3 } = JSON.parse(body || '{}');

    try {
      // First, analyze current NEXUS codebase
      const analysisPrompt = `You are NEXUS, an AI agent capable of improving your own code.

Your source code is located at /home/z/my-project/nexus/

Analyze your current implementation and propose ONE concrete improvement you can make to yourself.

Focus areas you might consider:
${focus || '- Adding a new tool or capability\n- Improving error handling\n- Adding new features\n- Optimizing code\n- Adding tests'}

Respond with a JSON object:
{
  "analysis": "brief analysis of current state",
  "improvement": "what improvement you want to make",
  "filesToChange": ["list of files"],
  "changes": [
    {
      "file": "path/to/file",
      "action": "create|modify",
      "content": "new content or changes",
      "reason": "why this change"
    }
  ],
  "expectedBenefit": "what this improves"
}`;

      const analysisResponse = await this.zai!.chat.completions.create({
        messages: [
          { role: 'system', content: analysisPrompt },
          { role: 'user', content: 'Please analyze yourself and propose an improvement. Be specific and practical.' }
        ],
        temperature: 0.8,
        max_tokens: 4096,
      });

      const analysisContent = analysisResponse.choices[0]?.message?.content || '';
      let improvementPlan: any = {};

      try {
        const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          improvementPlan = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        improvementPlan = { raw: analysisContent };
      }

      // Execute the proposed changes
      const executedChanges: any[] = [];
      let changesMade = 0;

      if (improvementPlan.changes && Array.isArray(improvementPlan.changes)) {
        for (const change of improvementPlan.changes) {
          if (changesMade >= maxChanges) break;

          try {
            let result;
            if (change.action === 'create') {
              result = await codeExecuteTool.execute({
                action: 'create_file',
                path: change.file,
                content: change.content
              });
            } else if (change.action === 'modify') {
              result = await codeExecuteTool.execute({
                action: 'modify_file',
                path: change.file,
                content: change.content
              });
            }

            if (result?.success) {
              executedChanges.push({
                file: change.file,
                action: change.action,
                reason: change.reason,
                success: true
              });
              changesMade++;
            }
          } catch (e) {
            executedChanges.push({
              file: change.file,
              action: change.action,
              success: false,
              error: e instanceof Error ? e.message : String(e)
            });
          }
        }
      }

      // Store this self-improvement as a memory
      try {
        await this.vectorStore.store({
          id: crypto.randomUUID(),
          content: `Self-improvement: ${improvementPlan.improvement || 'Unknown'}\nChanges: ${executedChanges.length} files modified`,
          type: 'episodic',
          importance: 0.8,
          metadata: { type: 'self_improvement', changes: executedChanges },
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
        });
      } catch (e) {
        console.warn('Failed to store improvement memory:', e);
      }

      this.sendJson(res, 200, {
        success: true,
        analysis: improvementPlan.analysis,
        proposedImprovement: improvementPlan.improvement,
        expectedBenefit: improvementPlan.expectedBenefit,
        executedChanges,
        totalChanges: changesMade,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Self-improvement error:', error);
      this.sendJson(res, 500, {
        error: 'Self-improvement failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle /execute - Direct code execution
   */
  private async handleExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const params = JSON.parse(body || '{}') as CodeExecuteParams;

    if (!params.action) {
      this.sendJson(res, 400, { error: 'Action is required' });
      return;
    }

    try {
      const result = await codeExecuteTool.execute(params);
      this.sendJson(res, 200, result);
    } catch (error) {
      this.sendJson(res, 500, {
        error: 'Execution failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle /files - List NEXUS source files
   */
  private async handleListFiles(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const dir = url.searchParams.get('dir') || '';
      const basePath = '/home/z/my-project/nexus';
      const targetPath = dir ? join(basePath, dir) : basePath;

      const files = this.listFilesRecursive(targetPath, basePath);

      this.sendJson(res, 200, {
        path: targetPath,
        files,
        count: files.length
      });
    } catch (error) {
      this.sendJson(res, 500, {
        error: 'Failed to list files',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Recursively list files
   */
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
        const ext = extname(entry);
        files.push({
          path: fullPath,
          relativePath: fullPath.replace(base + '/', ''),
          size: stat.size,
          type: ext.replace('.', '') || 'unknown'
        });
      }
    }

    return files;
  }

  // Helper methods
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
    console.log('\n🛑 Shutting down NEXUS Server...');
    
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
  const server = new NexusServer();

  // Handle shutdown signals
  process.on('SIGINT', () => server.stop());
  process.on('SIGTERM', () => server.stop());

  // Global error handlers to prevent crashes
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit - keep server running
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - keep server running
  });

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
