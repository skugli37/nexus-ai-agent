/**
 * NEXUS Interactive Chat System
 * Full-featured interactive chat with tool execution, memory, and skill integration
 */

import ZAI from 'z-ai-web-dev-sdk';
import readline from 'readline';
import { NexusConfig, SessionConfig } from './config';
import { VectorStore, VectorSearchResult } from '../core/vector-store';
import { ToolForge } from '../core/tool-forge';
import { SkillExecutor, SkillContext, SkillResult } from '../core/skill-executor';
import { toolsRegistry } from '../tools/registry';

// ============================================================================
// Types
// ============================================================================

export interface ChatOptions {
  sessionId?: string;
  profile?: string;
  debug?: boolean;
  model?: string;
  systemPrompt?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    toolsUsed?: string[];
    skillUsed?: string;
    memoryUsed?: boolean;
  };
}

export interface ChatSession {
  id: string;
  name: string;
  startedAt: Date;
  messages: ChatMessage[];
  stats: {
    totalMessages: number;
    totalTokens: number;
    toolsUsed: string[];
    skillsUsed: string[];
    memoriesCreated: number;
  };
}

// ============================================================================
// Interactive Chat Implementation
// ============================================================================

export class InteractiveChat {
  private config: NexusConfig;
  private session: SessionConfig;
  private options: ChatOptions;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private vectorStore: VectorStore;
  private toolForge: ToolForge;
  private skillExecutor: SkillExecutor;
  private rl: readline.Interface | null = null;
  private chatSession: ChatSession;
  private conversationHistory: ChatMessage[] = [];

  constructor(
    config: NexusConfig,
    session: SessionConfig,
    options: ChatOptions = {}
  ) {
    this.config = config;
    this.session = session;
    this.options = options;
    this.vectorStore = new VectorStore({ path: config.memoryPath });
    this.toolForge = new ToolForge(config.toolsPath);
    this.skillExecutor = new SkillExecutor(config.skillsPath);
    
    this.chatSession = {
      id: session.id,
      name: session.name,
      startedAt: new Date(),
      messages: [],
      stats: {
        totalMessages: 0,
        totalTokens: 0,
        toolsUsed: [],
        skillsUsed: [],
        memoriesCreated: 0
      }
    };
  }

  /**
   * Initialize chat system
   */
  async start(): Promise<void> {
    // Initialize all components
    this.zai = await ZAI.create();
    await this.vectorStore.initialize();
    await this.toolForge.initialize();
    await this.skillExecutor.initialize();

    // Show welcome message
    this.showWelcome();

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Start chat loop
    await this.chatLoop();
  }

  /**
   * Show welcome message
   */
  private showWelcome(): void {
    console.log('\n' + '═'.repeat(60));
    console.log('║' + ' '.repeat(58) + '║');
    console.log('║   🧠 NEXUS Interactive Chat System                      ║');
    console.log('║   Session: ' + this.session.name.padEnd(46) + '║');
    console.log('║' + ' '.repeat(58) + '║');
    console.log('═'.repeat(60));
    console.log('\nCommands:');
    console.log('  /help          - Show all commands');
    console.log('  /memorize      - Store information in memory');
    console.log('  /recall        - Search memories');
    console.log('  /skill         - Execute a skill');
    console.log('  /forge         - Create a new tool');
    console.log('  /tools         - List available tools');
    console.log('  /dream         - Run dream cycle');
    console.log('  /reflect       - Self-reflection');
    console.log('  /status        - Session status');
    console.log('  /clear         - Clear conversation');
    console.log('  /export        - Export session');
    console.log('  /exit          - End session');
    console.log('\n' + '─'.repeat(60) + '\n');
  }

  /**
   * Main chat loop
   */
  private async chatLoop(): Promise<void> {
    while (true) {
      try {
        const input = await this.question('\n\x1b[36mYou:\x1b[0m ');

        if (!input.trim()) continue;

        // Handle commands
        if (input.startsWith('/')) {
          const result = await this.handleCommand(input);
          if (result === 'exit') break;
          continue;
        }

        // Process with AI
        await this.processInput(input);

      } catch (error) {
        console.error('\n\x1b[31mError:\x1b[0m', error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Process user input with AI
   */
  private async processInput(input: string): Promise<void> {
    if (!this.zai) {
      console.error('ZAI not initialized');
      return;
    }

    // Add to history
    this.addMessage('user', input);

    // Search for relevant memories
    const memories = await this.vectorStore.search(input, 3);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(memories);

    // Build messages array
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...this.conversationHistory.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ];

    console.log('\n\x1b[32mNEXUS:\x1b[0m Thinking...');

    try {
      const response = await this.zai.chat.completions.create({
        messages,
        max_tokens: this.config.model.maxTokens,
        temperature: this.config.model.temperature
      });

      const assistantContent = response.choices[0]?.message?.content || '';

      // Add to history
      this.addMessage('assistant', assistantContent, {
        tokens: response.usage?.total_tokens,
        memoryUsed: memories.length > 0
      });

      // Update stats
      this.chatSession.stats.totalTokens += response.usage?.total_tokens || 0;

      // Auto-memorize important info
      await this.autoMemorize(input, assistantContent);

      // Display response
      console.log('\n' + assistantContent);

    } catch (error) {
      console.error('\n\x1b[31mError:\x1b[0m', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Build system prompt with memory context
   */
  private buildSystemPrompt(memories: VectorSearchResult[]): string {
    const skills = this.skillExecutor.listSkills();
    const tools = toolsRegistry.list();

    const memoryContext = memories.length > 0
      ? memories.map(m => `[${m.similarity.toFixed(2)}] ${m.content}`).join('\n')
      : 'No relevant memories found.';

    const skillList = skills.map(s => `- ${s.definition.name}: ${s.definition.description}`).join('\n');
    const toolList = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

    return `You are NEXUS, an advanced AI agent with autonomous capabilities.

## Identity
You have a dual-processing architecture:
- **Conscious**: Active, real-time reasoning and interaction
- **Subconscious**: Background memory processing and learning

## Available Skills
${skillList || 'No skills loaded'}

## Available Tools  
${toolList}

## Relevant Memories
${memoryContext}

## Behavior Guidelines
1. Be helpful, accurate, and proactive
2. Use available tools and skills when appropriate
3. Remember important information automatically
4. Explain your reasoning when asked
5. Suggest actions that could help the user
6. Be honest about limitations and uncertainties

## Special Capabilities
- You can create new tools with /forge command
- You can execute skills with /skill command
- You can store and recall memories
- You learn from each conversation`;
  }

  /**
   * Handle slash commands
   */
  private async handleCommand(input: string): Promise<string | void> {
    const [cmd, ...args] = input.slice(1).split(' ');

    switch (cmd.toLowerCase()) {
      case 'exit':
      case 'quit':
      case 'q':
        await this.saveSession();
        this.rl?.close();
        console.log('\n👋 Session ended. Goodbye!');
        return 'exit';

      case 'help':
      case 'h':
        this.showHelp();
        break;

      case 'memorize':
      case 'mem':
        await this.cmdMemorize(args.join(' '));
        break;

      case 'recall':
      case 'remember':
        await this.cmdRecall(args.join(' '));
        break;

      case 'skill':
        await this.cmdSkill(args);
        break;

      case 'forge':
      case 'create':
        await this.cmdForge(args);
        break;

      case 'tools':
      case 't':
        this.cmdTools();
        break;

      case 'skills':
      case 's':
        this.cmdSkills();
        break;

      case 'dream':
        await this.cmdDream();
        break;

      case 'reflect':
        await this.cmdReflect();
        break;

      case 'status':
      case 'stats':
        this.cmdStatus();
        break;

      case 'clear':
      case 'cls':
        this.conversationHistory = [];
        console.log('Conversation cleared.\n');
        break;

      case 'export':
        await this.cmdExport();
        break;

      default:
        console.log(`\nUnknown command: /${cmd}. Type /help for available commands.\n`);
    }
  }

  /**
   * Show help
   */
  private showHelp(): void {
    console.log(`
\x1b[33m═══════════════════════════════════════════════════════════\x1b[0m
\x1b[33m                    NEXUS Command Reference                    \x1b[0m
\x1b[33m═══════════════════════════════════════════════════════════\x1b[0m

\x1b[36mMemory Commands:\x1b[0m
  /memorize <text>    Store information in long-term memory
  /recall <query>     Search and retrieve memories
  /dream              Run dream cycle for memory consolidation

\x1b[36mTool & Skill Commands:\x1b[0m
  /tools              List all available tools
  /skills             List all loaded skills
  /skill <name>       Execute a skill with current context
  /forge <name> <desc> Create a new tool dynamically

\x1b[36mSession Commands:\x1b[0m
  /status             Show current session statistics
  /reflect            Run self-reflection analysis
  /clear              Clear conversation history
  /export             Export session to file
  /exit               End the session

\x1b[36mShortcuts:\x1b[0m
  /h = /help, /mem = /memorize, /t = /tools, /s = /skills
  /q = /exit, /cls = /clear

\x1b[33m───────────────────────────────────────────────────────────────\x1b[0m

\x1b[36mTips:\x1b[0m
  • NEXUS automatically memorizes important information
  • Use natural language - NEXUS understands context
  • Ask NEXUS to use specific tools or skills
  • Create new tools on-demand with /forge
  • Memory is persisted across sessions
`);
  }

  /**
   * Memorize command
   */
  private async cmdMemorize(content: string): Promise<void> {
    if (!content) {
      console.log('Usage: /memorize <content to remember>\n');
      return;
    }

    await this.vectorStore.store({
      id: crypto.randomUUID(),
      type: 'episodic',
      content,
      importance: 0.7,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date(),
      associations: [],
      metadata: { source: 'user-requested' }
    });

    this.chatSession.stats.memoriesCreated++;
    console.log('✅ Memorized successfully!\n');
  }

  /**
   * Recall command
   */
  private async cmdRecall(query: string): Promise<void> {
    if (!query) {
      console.log('Usage: /recall <search query>\n');
      return;
    }

    const results = await this.vectorStore.search(query, 5);

    if (results.length === 0) {
      console.log('No memories found.\n');
      return;
    }

    console.log(`\n\x1b[33m📚 Found ${results.length} memories:\x1b[0m\n`);
    
    for (const result of results) {
      const relevance = ((result.similarity) * 100).toFixed(1);
      const preview = result.content.length > 150 
        ? result.content.slice(0, 150) + '...' 
        : result.content;
      
      console.log(`  \x1b[2m[${relevance}%]\x1b[0m ${preview}`);
      console.log(`  \x1b[2mType: ${result.type} | Importance: ${result.importance.toFixed(2)}\x1b[0m\n`);
    }
  }

  /**
   * Skill command
   */
  private async cmdSkill(args: string[]): Promise<void> {
    const skillName = args[0];

    if (!skillName) {
      const skills = this.skillExecutor.listSkills();
      console.log('\n\x1b[33mAvailable Skills:\x1b[0m');
      
      for (const skill of skills) {
        const def = skill.definition;
        console.log(`  \x1b[36m${def.name}\x1b[0m: ${def.description}`);
        if (def.tags.length > 0) {
          console.log(`    Tags: ${def.tags.join(', ')}`);
        }
      }
      console.log('\nUsage: /skill <name>\n');
      return;
    }

    const skill = this.skillExecutor.getSkill(skillName);
    if (!skill) {
      console.log(`Skill '${skillName}' not found.\n`);
      return;
    }

    console.log(`\n🎯 Executing skill: ${skillName}...\n`);

    const context: SkillContext = {
      sessionId: this.session.id,
      inputs: { conversation: this.conversationHistory },
      memory: [],
      availableTools: toolsRegistry.list().map(t => t.name),
      metadata: {}
    };

    const result = await this.skillExecutor.execute(skillName, context);

    if (result.success) {
      console.log('\x1b[32m✅ Success:\x1b[0m\n');
      console.log(JSON.stringify(result.output, null, 2));
      if (result.reasoning) {
        console.log(`\n\x1b[2mReasoning: ${result.reasoning}\x1b[0m`);
      }
      console.log(`\n\x1b[2mDuration: ${result.duration}ms | Tokens: ${result.tokensUsed}\x1b[0m\n`);
      
      this.chatSession.stats.skillsUsed.push(skillName);
    } else {
      console.log('\x1b[31m❌ Failed:\x1b[0m No output\n');
    }
  }

  /**
   * Forge command
   */
  private async cmdForge(args: string[]): Promise<void> {
    const name = args[0];
    const description = args.slice(1).join(' ');

    if (!name) {
      console.log('Usage: /forge <tool-name> <description>\n');
      console.log('Example: /forge data-cleaner Removes duplicates from arrays\n');
      return;
    }

    console.log(`\n🔨 Forging tool: ${name}...\n`);

    const result = await this.toolForge.forge({
      name,
      description: description || `Tool for ${name}`,
      inputSchema: {
        input: { type: 'string', description: 'Input data', required: true }
      }
    });

    if (result.success && result.tool) {
      console.log('\x1b[32m✅ Tool forged successfully!\x1b[0m');
      console.log(`   \x1b[36mFile:\x1b[0m ${result.tool.filePath}`);
      
      if (result.suggestions && result.suggestions.length > 0) {
        console.log(`   \x1b[33mSuggestions:\x1b[0m`);
        for (const s of result.suggestions) {
          console.log(`     - ${s}`);
        }
      }
      console.log();
    } else {
      console.log(`\x1b[31m❌ Tool forge failed:\x1b[0m ${result.error}\n`);
    }
  }

  /**
   * Tools command
   */
  private cmdTools(): void {
    const tools = toolsRegistry.list();
    
    console.log(`\n\x1b[33m🔧 Available Tools (${tools.length}):\x1b[0m\n`);
    
    for (const tool of tools) {
      console.log(`  \x1b[36m${tool.name}\x1b[0m`);
      console.log(`    ${tool.description}`);
      if (tool.parameters.length > 0) {
        console.log(`    Parameters: ${tool.parameters.map(p => p.type).join(', ')}`);
      }
    }
    console.log();
  }

  /**
   * Skills command
   */
  private cmdSkills(): void {
    const skills = this.skillExecutor.listSkills();
    
    console.log(`\n\x1b[33m📚 Loaded Skills (${skills.length}):\x1b[0m\n`);
    
    for (const skill of skills) {
      const def = skill.definition;
      console.log(`  \x1b[36m${def.name}\x1b[0m v${def.version}`);
      console.log(`    ${def.description}`);
      if (def.tags.length > 0) {
        console.log(`    Tags: ${def.tags.join(', ')}`);
      }
    }
    console.log();
  }

  /**
   * Dream command
   */
  private async cmdDream(): Promise<void> {
    console.log('\n🌙 Running dream cycle...\n');

    const stats = await this.vectorStore.getStats();
    
    console.log(`  Memory entries: ${stats.total}`);
    console.log(`  By type: ${JSON.stringify(stats.byType)}`);
    console.log(`  Average importance: ${stats.avgImportance.toFixed(2)}`);
    console.log(`  Total accesses: ${stats.totalAccessCount}`);

    // Find similar memories for consolidation
    const similar = await this.vectorStore.findSimilar(0.85);
    if (similar.length > 0) {
      console.log(`\n  Found ${similar.length} groups of similar memories to consolidate`);
    }

    console.log('\n✅ Dream cycle complete!\n');
  }

  /**
   * Reflect command
   */
  private async cmdReflect(): Promise<void> {
    console.log('\n🪞 Running self-reflection...\n');

    const skillStats = this.skillExecutor.getStats();
    const toolStats = toolsRegistry.getStats();
    const memStats = await this.vectorStore.getStats();

    console.log('  \x1b[33mSession Statistics:\x1b[0m');
    console.log(`    Messages: ${this.chatSession.stats.totalMessages}`);
    console.log(`    Tokens used: ${this.chatSession.stats.totalTokens}`);
    console.log(`    Tools used: ${this.chatSession.stats.toolsUsed.length}`);
    console.log(`    Skills used: ${this.chatSession.stats.skillsUsed.length}`);
    console.log(`    Memories created: ${this.chatSession.stats.memoriesCreated}`);

    console.log('\n  \x1b[33mMemory Statistics:\x1b[0m');
    console.log(`    Total memories: ${memStats.total}`);
    console.log(`    Average importance: ${memStats.avgImportance.toFixed(2)}`);

    console.log('\n  \x1b[33mTool Statistics:\x1b[0m');
    console.log(`    Total executions: ${toolStats.totalExecutions}`);
    console.log(`    Success rate: ${(toolStats.successRate * 100).toFixed(1)}%`);

    console.log('\n✅ Reflection complete!\n');
  }

  /**
   * Status command
   */
  private cmdStatus(): void {
    console.log(`
\x1b[33m═══════════════════════════════════════════════════════════\x1b[0m
\x1b[33m                    Session Status                           \x1b[0m
\x1b[33m═══════════════════════════════════════════════════════════\x1b[0m

  Session ID:    ${this.session.id}
  Name:          ${this.session.name}
  Status:        ${this.session.status}
  Started:       ${this.chatSession.startedAt.toLocaleString()}
  Duration:      ${Math.round((Date.now() - this.chatSession.startedAt.getTime()) / 1000 / 60)} minutes

\x1b[36mStatistics:\x1b[0m
  Messages:      ${this.chatSession.stats.totalMessages}
  Tokens:        ${this.chatSession.stats.totalTokens}
  Tools Used:    ${this.chatSession.stats.toolsUsed.length}
  Skills Used:   ${this.chatSession.stats.skillsUsed.length}
  Memories:      ${this.chatSession.stats.memoriesCreated}

\x1b[33m───────────────────────────────────────────────────────────────\x1b[0m
`);
  }

  /**
   * Export command
   */
  private async cmdExport(): Promise<void> {
    const exportPath = `.nexus/sessions/${this.session.id}-export.json`;
    const data = {
      session: this.chatSession,
      exportedAt: new Date().toISOString()
    };

    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { dirname } = await import('path');
    
    const dir = dirname(exportPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(exportPath, JSON.stringify(data, null, 2));
    console.log(`\n✅ Session exported to: ${exportPath}\n`);
  }

  /**
   * Auto-memorize important information
   */
  private async autoMemorize(userInput: string, assistantResponse: string): Promise<void> {
    const combined = `${userInput}\n${assistantResponse}`;

    // Patterns that indicate important information
    const importantPatterns = [
      /remember\s+(this|that|the following)/i,
      /my\s+(name|email|phone|address|birthday|favorite)/i,
      /I\s+(prefer|like|want|need|have|hate)/i,
      /important[:!]/i,
      /don'?t\s+forget/i,
      /key\s+(information|fact|point)/i,
      /note\s+(that|this)/i,
      /please\s+(remember|save|store)/i
    ];

    const isImportant = importantPatterns.some(p => p.test(combined));

    if (isImportant) {
      await this.vectorStore.store({
        id: crypto.randomUUID(),
        type: 'episodic',
        content: combined,
        importance: 0.8,
        accessCount: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        associations: [],
        metadata: { source: 'auto-memorized', important: true }
      });

      this.chatSession.stats.memoriesCreated++;
    }
  }

  /**
   * Save session
   */
  private async saveSession(): Promise<void> {
    // Session is saved in memory and can be exported
  }

  /**
   * Add message to history
   */
  private addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: ChatMessage['metadata']
  ): void {
    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    this.conversationHistory.push(message);
    this.chatSession.messages.push(message);
    this.chatSession.stats.totalMessages++;
  }

  /**
   * Question helper
   */
  private question(prompt: string): Promise<string> {
    return new Promise(resolve => {
      this.rl?.question(prompt, resolve);
    });
  }
}

export default InteractiveChat;
