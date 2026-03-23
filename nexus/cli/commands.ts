/**
 * NEXUS CLI Commands Implementation
 * All CLI commands: init, start, stop, status, chat, dream, forge, reflect
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import ZAI from 'z-ai-web-dev-sdk';
import readline from 'readline';
import {
  ConfigManager,
  SessionManager,
  NexusConfig,
  SessionConfig,
} from './config';
import {
  NodeExecutor,
  PipelineBuilder,
  SkillLoader,
  MemoryManager,
  ToolRegistry,
  BuildNode,
} from './build-node';

// ============================================================================
// Types
// ============================================================================

export interface CommandResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface CommandContext {
  config: NexusConfig;
  configManager: ConfigManager;
  sessionManager: SessionManager;
  session?: SessionConfig;
  executor?: NodeExecutor;
}

type CommandHandler = (
  args: string[],
  context: CommandContext
) => Promise<CommandResult>;

// ============================================================================
// Command Registry
// ============================================================================

export const commands: Map<string, {
  handler: CommandHandler;
  description: string;
  usage: string;
}> = new Map();

function registerCommand(
  name: string,
  description: string,
  usage: string,
  handler: CommandHandler
) {
  commands.set(name, { handler, description, usage });
}

// ============================================================================
// INIT Command
// ============================================================================

registerCommand(
  'init',
  'Initialize a new NEXUS project',
  'nexus init [project-name]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const projectName = args[0] || 'nexus-project';
    const projectPath = join(process.cwd(), projectName);

    // Check if project already exists
    if (existsSync(projectPath)) {
      return {
        success: false,
        message: `Directory ${projectName} already exists`,
      };
    }

    // Create project structure
    const dirs = [
      projectPath,
      join(projectPath, '.nexus'),
      join(projectPath, '.nexus', 'skills'),
      join(projectPath, '.nexus', 'memory'),
      join(projectPath, '.nexus', 'sessions'),
      join(projectPath, '.nexus', 'tools'),
      join(projectPath, '.nexus', 'logs'),
    ];

    for (const dir of dirs) {
      mkdirSync(dir, { recursive: true });
    }

    // Create project config
    const projectConfig = {
      name: projectName,
      version: '1.0.0',
      created: new Date().toISOString(),
      nexus: {
        home: '.nexus',
        model: context.config.model,
        agent: context.config.agent,
      },
    };

    writeFileSync(
      join(projectPath, 'nexus.json'),
      JSON.stringify(projectConfig, null, 2)
    );

    // Create default skill
    const defaultSkill = `---
name: "hello"
description: "Default hello skill"
version: "1.0.0"
tags: ["default", "greeting"]
---

# Hello Skill

You are a helpful assistant. Greet the user and offer assistance.

## Instructions
- Be friendly and professional
- Ask how you can help
- Provide clear and concise responses
`;

    writeFileSync(
      join(projectPath, '.nexus', 'skills', 'hello.skill.md'),
      defaultSkill
    );

    // Create README
    const readme = `# ${projectName}

A NEXUS agent project.

## Getting Started

\`\`\`bash
# Start the agent
bun run nexus start

# Chat with the agent
bun run nexus chat

# View status
bun run nexus status
\`\`\`

## Commands

- \`init\` - Initialize a new project
- \`start\` - Start the NEXUS agent
- \`stop\` - Stop the agent
- \`status\` - View agent status
- \`chat\` - Interactive chat mode
- \`dream\` - Run dream cycle
- \`forge\` - Create new tools
- \`reflect\` - Self-reflection

## Skills

Skills are stored in \`.nexus/skills/\` as \`.skill.md\` files.

## Memory

Memory is stored in \`.nexus/memory/\` and persists across sessions.
`;

    writeFileSync(join(projectPath, 'README.md'), readme);

    return {
      success: true,
      message: `✨ NEXUS project "${projectName}" initialized successfully!`,
      data: {
        path: projectPath,
        structure: dirs,
      },
    };
  }
);

// ============================================================================
// START Command
// ============================================================================

registerCommand(
  'start',
  'Start the NEXUS agent',
  'nexus start [session-id]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const sessionId = args[0];

    // Initialize directories
    context.configManager.initializeDirectories();

    // Create or load session
    let session: SessionConfig;
    if (sessionId) {
      const existingSession = context.sessionManager.loadSession(sessionId);
      if (!existingSession) {
        return {
          success: false,
          message: `Session ${sessionId} not found`,
        };
      }
      session = existingSession;
    } else {
      session = context.sessionManager.createSession('nexus-session');
    }

    // Update session status
    context.sessionManager.updateSessionStatus(session.id, 'running');

    // Initialize executor
    const executor = new NodeExecutor(context.config);
    await executor.initialize();

    return {
      success: true,
      message: `🚀 NEXUS agent started!\nSession: ${session.name} (${session.id})`,
      data: {
        sessionId: session.id,
        sessionName: session.name,
        status: 'running',
        skillsLoaded: executor.getSkillLoader().listSkills().length,
        memoryEntries: executor.getMemory().getStats().total,
      },
    };
  }
);

// ============================================================================
// STOP Command
// ============================================================================

registerCommand(
  'stop',
  'Stop the NEXUS agent',
  'nexus stop [session-id]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const sessionId = args[0];

    if (!sessionId) {
      // Stop all running sessions
      const sessions = context.sessionManager.listSessions();
      const runningSessions = sessions.filter(s => s.status === 'running');

      if (runningSessions.length === 0) {
        return {
          success: true,
          message: 'No running sessions to stop',
        };
      }

      for (const session of runningSessions) {
        context.sessionManager.updateSessionStatus(session.id, 'stopped');
      }

      return {
        success: true,
        message: `🛑 Stopped ${runningSessions.length} session(s)`,
        data: {
          stoppedSessions: runningSessions.map(s => s.id),
        },
      };
    }

    // Stop specific session
    const session = context.sessionManager.loadSession(sessionId);
    if (!session) {
      return {
        success: false,
        message: `Session ${sessionId} not found`,
      };
    }

    context.sessionManager.updateSessionStatus(sessionId, 'stopped');

    return {
      success: true,
      message: `🛑 Session ${session.name} stopped`,
      data: {
        sessionId,
        status: 'stopped',
      },
    };
  }
);

// ============================================================================
// STATUS Command
// ============================================================================

registerCommand(
  'status',
  'Show NEXUS agent status',
  'nexus status [session-id]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const sessionId = args[0];

    // Validate configuration
    const validation = context.configManager.validate();

    // Get memory stats
    const memory = new MemoryManager(context.config);
    const memoryStats = memory.getStats();

    // Get skills
    const skillLoader = new SkillLoader(context.config);
    await skillLoader.loadAll();
    const skills = skillLoader.listSkills();

    // Get tools
    const tools = new ToolRegistry();

    // Build status report
    let report = '📊 NEXUS Status Report\n';
    report += '═══════════════════════════════════\n\n';
    
    report += 'Configuration\n';
    report += `  Home: ${context.config.nexusHome}\n`;
    report += `  Valid: ${validation.valid ? '✅' : '❌'}\n`;
    if (!validation.valid) {
      report += `  Errors: ${validation.errors.join(', ')}\n`;
    }
    report += '\n';

    report += 'Model Settings\n';
    report += `  Primary: ${context.config.model.primaryModel}\n`;
    report += `  Utility: ${context.config.model.utilityModel}\n`;
    report += `  Max Tokens: ${context.config.model.maxTokens}\n`;
    report += '\n';

    report += 'Agent Settings\n';
    report += `  Profile: ${context.config.agent.defaultProfile}\n`;
    report += `  Max Subordinates: ${context.config.agent.maxSubordinates}\n`;
    report += `  Autonomous: ${context.config.agent.autonomousMode}\n`;
    report += '\n';

    report += 'Memory\n';
    report += `  Total Entries: ${memoryStats.total}\n`;
    for (const [type, count] of Object.entries(memoryStats.byType)) {
      report += `  ${type}: ${count}\n`;
    }
    report += '\n';

    report += `Skills: ${skills.length} loaded\n`;
    for (const skill of skills.slice(0, 5)) {
      report += `  - ${skill.name}: ${skill.description.slice(0, 50)}...\n`;
    }
    if (skills.length > 5) {
      report += `  ... and ${skills.length - 5} more\n`;
    }
    report += '\n';

    report += `Tools: ${tools.list().length} registered\n`;
    report += '\n';

    // Session info
    if (sessionId) {
      const session = context.sessionManager.loadSession(sessionId);
      if (session) {
        report += 'Session\n';
        report += `  ID: ${session.id}\n`;
        report += `  Name: ${session.name}\n`;
        report += `  Status: ${session.status}\n`;
        report += `  Created: ${session.createdAt}\n`;
        report += `  Updated: ${session.updatedAt}\n`;
      } else {
        report += `Session ${sessionId} not found\n`;
      }
    } else {
      const sessions = context.sessionManager.listSessions();
      report += `Sessions: ${sessions.length} total\n`;
      const running = sessions.filter(s => s.status === 'running');
      if (running.length > 0) {
        report += `Running: ${running.map(s => s.name).join(', ')}\n`;
      }
    }

    return {
      success: true,
      message: report,
      data: {
        config: validation,
        memory: memoryStats,
        skills: skills.length,
        tools: tools.list().length,
      },
    };
  }
);

// ============================================================================
// CHAT Command
// ============================================================================

registerCommand(
  'chat',
  'Interactive chat with NEXUS agent',
  'nexus chat [session-id]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const sessionId = args[0];

    // Initialize
    context.configManager.initializeDirectories();
    const executor = new NodeExecutor(context.config);
    await executor.initialize();

    // Create or load session
    let session: SessionConfig;
    if (sessionId) {
      const existingSession = context.sessionManager.loadSession(sessionId);
      if (!existingSession) {
        return {
          success: false,
          message: `Session ${sessionId} not found`,
        };
      }
      session = existingSession;
    } else {
      session = context.sessionManager.createSession('chat-session');
    }

    context.sessionManager.updateSessionStatus(session.id, 'running');

    // For non-interactive mode, return setup info
    return {
      success: true,
      message: `💬 Chat session ready: ${session.id}\nUse interactive mode to chat.`,
      data: {
        sessionId: session.id,
        session,
        mode: 'interactive',
      },
    };
  }
);

// ============================================================================
// DREAM Command
// ============================================================================

registerCommand(
  'dream',
  'Run dream cycle for knowledge consolidation',
  'nexus dream [--deep] [--duration <minutes>]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const deepMode = args.includes('--deep');
    const durationIdx = args.indexOf('--duration');
    const duration = durationIdx !== -1 ? parseInt(args[durationIdx + 1]) || 5 : 5;

    // Initialize
    const executor = new NodeExecutor(context.config);
    await executor.initialize();
    const memory = executor.getMemory();

    console.log('🌙 Starting dream cycle...');
    console.log(`Mode: ${deepMode ? 'Deep' : 'Light'}`);
    console.log(`Duration: ${duration} minutes`);

    try {
      const zai = await ZAI.create();

      // Get all memory entries
      const mainEntries = memory.getByType('main');
      const fragments = memory.getByType('fragment');
      const solutions = memory.getByType('solution');

      console.log(`\n📚 Processing ${fragments.length} fragments...`);

      // Consolidate fragments into main memory
      if (fragments.length > 0) {
        const fragmentContents = fragments.map(f => f.content).join('\n---\n');
        
        const consolidation = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a memory consolidation system. Analyze the following fragments and extract durable knowledge. 
Create concise, well-structured main memory entries. Focus on:
- Key facts and patterns
- User preferences
- Important relationships
- Problem-solving strategies

Output JSON array of consolidated entries.`,
            },
            {
              role: 'user',
              content: fragmentContents,
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        });

        const consolidated = consolidation.choices[0]?.message?.content || '[]';
        console.log('\n✨ Consolidated knowledge:');
        console.log(consolidated);
      }

      // Deep mode: Generate new solutions from patterns
      if (deepMode && solutions.length > 0) {
        console.log(`\n🔬 Analyzing ${solutions.length} solutions...`);
        
        const solutionContents = solutions.map(s => s.content).join('\n---\n');
        
        const analysis = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a pattern analysis system. Analyze the following solutions and identify:
1. Common patterns
2. Reusable strategies
3. Potential improvements
4. New skill ideas

Output your analysis in markdown format.`,
            },
            {
              role: 'user',
              content: solutionContents,
            },
          ],
          max_tokens: 2000,
          temperature: 0.5,
        });

        const analysisResult = analysis.choices[0]?.message?.content || '';
        console.log('\n📊 Pattern analysis:');
        console.log(analysisResult);

        // Store analysis as a memory entry
        await memory.memorize(analysisResult, 'solution', {
          tags: ['dream-analysis', deepMode ? 'deep' : 'light'],
        });
      }

      return {
        success: true,
        message: `🌙 Dream cycle completed!\nProcessed ${fragments.length} fragments, ${solutions.length} solutions.`,
        data: {
          mode: deepMode ? 'deep' : 'light',
          duration,
          processed: {
            fragments: fragments.length,
            solutions: solutions.length,
            main: mainEntries.length,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Dream cycle failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
);

// ============================================================================
// FORGE Command
// ============================================================================

registerCommand(
  'forge',
  'Create new tools and skills',
  'nexus forge <tool|skill> <name> [--description <desc>]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const type = args[0];
    const name = args[1];

    if (!type || !name) {
      return {
        success: false,
        message: 'Usage: nexus forge <tool|skill> <name>',
      };
    }

    const descIdx = args.indexOf('--description');
    const description = descIdx !== -1 ? args[descIdx + 1] : `A ${type} named ${name}`;

    context.configManager.initializeDirectories();

    if (type === 'skill') {
      // Create skill file
      const skillContent = `---
name: "${name}"
description: "${description}"
version: "1.0.0"
tags: ["custom", "forge"]
---

# ${name} Skill

${description}

## Instructions

Define your skill instructions here.

## Inputs

- input1: Description of input 1
- input2: Description of input 2

## Outputs

- result: Description of output

## Example Usage

\`\`\`
nexus chat
> Use ${name} to process input1
\`\`\`
`;

      const skillPath = join(context.config.skillsPath, `${name}.skill.md`);
      writeFileSync(skillPath, skillContent);

      return {
        success: true,
        message: `🔨 Forged new skill: ${name}\nPath: ${skillPath}`,
        data: {
          type: 'skill',
          name,
          path: skillPath,
        },
      };
    } else if (type === 'tool') {
      // Create tool file
      const toolContent = `/**
 * ${name} Tool
 * ${description}
 */

export const ${name}Tool = {
  name: '${name}',
  description: '${description}',
  parameters: {
    input: {
      type: 'string',
      description: 'Input parameter',
      required: true,
    },
  },
  handler: async (params: { input: string }) => {
    // Implement tool logic here
    console.log('Tool ${name} called with:', params);
    return {
      success: true,
      result: \`Processed: \${params.input}\`,
    };
  },
};

export default ${name}Tool;
`;

      const toolPath = join(context.config.toolsPath, `${name}.ts`);
      writeFileSync(toolPath, toolContent);

      return {
        success: true,
        message: `🔨 Forged new tool: ${name}\nPath: ${toolPath}`,
        data: {
          type: 'tool',
          name,
          path: toolPath,
        },
      };
    }

    return {
      success: false,
      message: `Unknown type: ${type}. Use 'tool' or 'skill'`,
    };
  }
);

// ============================================================================
// REFLECT Command
// ============================================================================

registerCommand(
  'reflect',
  'Run self-reflection for behavior adjustment',
  'nexus reflect [--session <session-id>]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const sessionIdx = args.indexOf('--session');
    const sessionId = sessionIdx !== -1 ? args[sessionIdx + 1] : undefined;

    // Initialize
    const executor = new NodeExecutor(context.config);
    await executor.initialize();
    const memory = executor.getMemory();

    console.log('🪞 Starting self-reflection...');

    try {
      const zai = await ZAI.create();

      // Get recent activity
      const sessions = context.sessionManager.listSessions();
      const recentSessions = sessions.slice(0, 5);
      const solutions = memory.getByType('solution');
      const fragments = memory.getByType('fragment');

      // Build reflection context
      const reflectionContext = {
        recentSessions: recentSessions.map(s => ({
          name: s.name,
          status: s.status,
          created: s.createdAt,
        })),
        solutionCount: solutions.length,
        fragmentCount: fragments.length,
        memoryStats: memory.getStats(),
      };

      const reflection = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a self-reflection system for an AI agent. Analyze the agent's recent activity and provide:

1. Performance Analysis
   - What's working well
   - Areas for improvement

2. Behavior Recommendations
   - Rules to adopt
   - Rules to modify or remove

3. Knowledge Gaps
   - Missing information
   - Skills to acquire

4. Efficiency Improvements
   - Workflow optimizations
   - Resource usage

Output your reflection in markdown format with clear sections.`,
          },
          {
            role: 'user',
            content: JSON.stringify(reflectionContext, null, 2),
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      const reflectionResult = reflection.choices[0]?.message?.content || '';
      console.log('\n📊 Self-Reflection Results:\n');
      console.log(reflectionResult);

      // Generate behavior adjustments
      const behaviorPrompt = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a behavior rule generator. Based on the reflection, generate concise behavior rules.
Rules should be:
- Specific and actionable
- Written in second person ("You...")
- Limited to 5-10 rules

Output rules as a markdown list.`,
          },
          {
            role: 'user',
            content: `Reflection:\n${reflectionResult}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.5,
      });

      const behaviorRules = behaviorPrompt.choices[0]?.message?.content || '';
      console.log('\n📋 Generated Behavior Rules:\n');
      console.log(behaviorRules);

      // Store reflection in memory
      await memory.memorize(
        `# Self-Reflection\n\n${reflectionResult}\n\n## Behavior Rules\n\n${behaviorRules}`,
        'solution',
        { tags: ['reflection', 'behavior'] }
      );

      return {
        success: true,
        message: '🪞 Self-reflection completed!\nBehavior rules updated.',
        data: {
          reflection: reflectionResult,
          behaviorRules,
          stats: reflectionContext,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Reflection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
);

// ============================================================================
// HELP Command
// ============================================================================

registerCommand(
  'help',
  'Show help information',
  'nexus help [command]',
  async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const commandName = args[0];

    if (commandName) {
      const command = commands.get(commandName);
      if (!command) {
        return {
          success: false,
          message: `Unknown command: ${commandName}`,
        };
      }

      return {
        success: true,
        message: `${commandName}\n\n${command.description}\n\nUsage: ${command.usage}`,
      };
    }

    // Show all commands
    let help = '🤖 NEXUS CLI - AI Agent Framework\n';
    help += '═══════════════════════════════════\n\n';
    help += 'Commands:\n\n';

    for (const [name, cmd] of commands) {
      help += `  ${name.padEnd(10)} ${cmd.description}\n`;
    }

    help += '\nUsage: nexus <command> [options]\n';
    help += '\nOptions:\n';
    help += '  --help, -h    Show this help\n';
    help += '  --version, -v Show version\n';
    help += '  --debug       Enable debug mode\n';

    return {
      success: true,
      message: help,
    };
  }
);

// ============================================================================
// VERSION Command
// ============================================================================

registerCommand(
  'version',
  'Show NEXUS version',
  'nexus version',
  async (): Promise<CommandResult> => {
    return {
      success: true,
      message: 'NEXUS CLI v1.0.0\nPowered by z-ai-web-dev-sdk',
      data: {
        version: '1.0.0',
        sdk: 'z-ai-web-dev-sdk',
      },
    };
  }
);

// ============================================================================
// Execute Command
// ============================================================================

export async function executeCommand(
  commandName: string,
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const command = commands.get(commandName);
  
  if (!command) {
    return {
      success: false,
      message: `Unknown command: ${commandName}\nRun 'nexus help' for available commands.`,
    };
  }

  return command.handler(args, context);
}

// ============================================================================
// Interactive Chat Loop
// ============================================================================

export async function startInteractiveChat(
  context: CommandContext,
  sessionId?: string
): Promise<void> {
  // Initialize
  context.configManager.initializeDirectories();
  const executor = new NodeExecutor(context.config);
  await executor.initialize();

  // Create or load session
  let session: SessionConfig;
  if (sessionId) {
    const existingSession = context.sessionManager.loadSession(sessionId);
    if (!existingSession) {
      console.log(`Session ${sessionId} not found, creating new session`);
      session = context.sessionManager.createSession('chat-session');
    } else {
      session = existingSession;
    }
  } else {
    session = context.sessionManager.createSession('chat-session');
  }

  context.sessionManager.updateSessionStatus(session.id, 'running');
  console.log(`\n💬 NEXUS Chat Session: ${session.id}`);
  console.log('Type your message or /help for commands. /exit to quit.\n');

  const zai = await ZAI.create();
  const memory = executor.getMemory();
  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise(resolve => {
      rl.question(prompt, resolve);
    });
  };

  // Main chat loop
  while (true) {
    const input = await question('You: ');

    if (!input.trim()) continue;

    // Handle commands
    if (input.startsWith('/')) {
      const [cmd, ...cmdArgs] = input.slice(1).split(' ');

      switch (cmd) {
        case 'exit':
        case 'quit':
          rl.close();
          context.sessionManager.updateSessionStatus(session.id, 'stopped');
          console.log('\n👋 Goodbye!');
          return;

        case 'help':
          console.log('\nCommands:');
          console.log('  /help     - Show this help');
          console.log('  /exit     - Exit chat');
          console.log('  /clear    - Clear conversation');
          console.log('  /memorize - Memorize something');
          console.log('  /recall   - Recall from memory');
          console.log('  /status   - Show session status');
          console.log('  /dream    - Run quick dream cycle');
          console.log();
          break;

        case 'clear':
          conversationHistory.length = 0;
          console.log('Conversation cleared.\n');
          break;

        case 'memorize':
          const contentToMemorize = cmdArgs.join(' ');
          if (contentToMemorize) {
            await memory.memorize(contentToMemorize, 'main');
            console.log('✅ Memorized!\n');
          } else {
            console.log('Usage: /memorize <content>\n');
          }
          break;

        case 'recall':
          const query = cmdArgs.join(' ');
          if (query) {
            const results = await memory.recall(query, 3);
            console.log('\n📚 Recall results:');
            for (const entry of results) {
              console.log(`  [${entry.type}] ${entry.content.slice(0, 100)}...`);
            }
            console.log();
          } else {
            console.log('Usage: /recall <query>\n');
          }
          break;

        case 'status':
          console.log(`\n📊 Session: ${session.name}`);
          console.log(`   Status: ${session.status}`);
          console.log(`   Memory: ${memory.getStats().total} entries`);
          console.log(`   History: ${conversationHistory.length} messages\n`);
          break;

        case 'dream':
          console.log('\n🌙 Running quick dream cycle...');
          const fragments = memory.getByType('fragment');
          if (fragments.length > 0) {
            console.log(`Processed ${fragments.length} fragments.`);
          }
          console.log('Done!\n');
          break;

        default:
          console.log(`Unknown command: /${cmd}\n`);
      }

      continue;
    }

    // Process with AI
    conversationHistory.push({ role: 'user', content: input });

    // Recall relevant memories
    const relevantMemories = await memory.recall(input, 3);
    const memoryContext = relevantMemories.map(m => m.content).join('\n');

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: `You are NEXUS, an intelligent AI agent. You have access to memory and can help with various tasks.

Relevant memories:
${memoryContext || 'No relevant memories found.'}

Be helpful, concise, and proactive. Use the memorize tool to save important information.`,
      },
      ...conversationHistory,
    ];

    try {
      const response = await zai.chat.completions.create({
        messages,
        max_tokens: context.config.model.maxTokens,
        temperature: context.config.model.temperature,
      });

      const assistantMessage = response.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
      conversationHistory.push({ role: 'assistant', content: assistantMessage });

      console.log(`\nNEXUS: ${assistantMessage}\n`);
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}
