#!/usr/bin/env bun
/**
 * NEXUS CLI - Main Entry Point
 * 
 * An intelligent AI agent framework inspired by Agent Zero and OpenClaw.
 * Features self-evolution, memory persistence, skill system, and tool creation.
 * 
 * Usage:
 *   bun run nexus-cli.ts <command> [options]
 * 
 * Commands:
 *   init      Initialize a new NEXUS project
 *   start     Start the NEXUS agent
 *   stop      Stop the agent
 *   status    View agent status
 *   chat      Interactive chat mode
 *   dream     Run dream cycle
 *   forge     Create new tools/skills
 *   reflect   Run self-reflection
 * 
 * Environment Variables:
 *   NEXUS_HOME            - Home directory for NEXUS (default: ~/.nexus)
 *   NEXUS_PRIMARY_MODEL   - Primary model for main tasks
 *   NEXUS_UTILITY_MODEL   - Utility model for summarization
 *   NEXUS_MAX_TOKENS      - Maximum tokens for responses
 *   NEXUS_TEMPERATURE     - Temperature for responses
 *   NEXUS_DEBUG           - Enable debug mode
 */

import { parseArgs } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  ConfigManager,
  SessionManager,
  NexusConfig,
  SessionConfig,
} from './config';
import {
  executeCommand,
  startInteractiveChat,
  commands,
} from './commands';
import {
  NodeExecutor,
  PipelineBuilder,
  SkillLoader,
  MemoryManager,
  ToolRegistry,
} from './build-node';

// ============================================================================
// Types
// ============================================================================

interface ParsedCLI {
  command: string;
  args: string[];
  options: Record<string, string | boolean | undefined>;
}

// ============================================================================
// CLI Parser
// ============================================================================

function parseCLI(argv: string[]): ParsedCLI {
  // Parse command line arguments
  const { values, positionals } = parseArgs({
    args: argv.slice(2), // Skip 'bun' and script name
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      version: {
        type: 'boolean',
        short: 'v',
      },
      debug: {
        type: 'boolean',
        short: 'd',
      },
      config: {
        type: 'string',
        short: 'c',
      },
      session: {
        type: 'string',
        short: 's',
      },
      interactive: {
        type: 'boolean',
        short: 'i',
      },
      noninteractive: {
        type: 'boolean',
        short: 'n',
      },
      output: {
        type: 'string',
        short: 'o',
      },
    },
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0] || 'help';
  const args = positionals.slice(1);

  return {
    command,
    args,
    options: values as Record<string, string | boolean | undefined>,
  };
}

// ============================================================================
// NEXUS CLI Class
// ============================================================================

class NexusCLI {
  private configManager: ConfigManager;
  private sessionManager: SessionManager;
  private config: NexusConfig;
  private debug: boolean;

  constructor(options?: { configPath?: string; debug?: boolean }) {
    this.debug = options?.debug || false;
    this.configManager = new ConfigManager(
      options?.configPath ? join(options.configPath, '.nexus') : undefined
    );
    this.config = this.configManager.getConfig();
    this.sessionManager = new SessionManager(this.config);

    if (this.debug) {
      console.log('Debug mode enabled');
      console.log('Config:', JSON.stringify(this.config, null, 2));
    }
  }

  /**
   * Run the CLI
   */
  async run(argv: string[]): Promise<number> {
    const parsed = parseCLI(argv);

    // Handle global options
    if (parsed.options.version) {
      console.log('NEXUS CLI v1.0.0');
      console.log('Powered by z-ai-web-dev-sdk');
      return 0;
    }

    if (parsed.options.help && parsed.command === 'help') {
      this.showHelp();
      return 0;
    }

    // Check for project-local config
    const localConfigPath = join(process.cwd(), 'nexus.json');
    if (existsSync(localConfigPath) && !parsed.options.config) {
      if (this.debug) {
        console.log('Found local project config:', localConfigPath);
      }
      // Reload config from project directory
      this.configManager = new ConfigManager(process.cwd());
      this.config = this.configManager.getConfig();
      this.sessionManager = new SessionManager(this.config);
    }

    // Build context
    const context = {
      config: this.config,
      configManager: this.configManager,
      sessionManager: this.sessionManager,
    };

    // Handle interactive mode
    if (
      parsed.command === 'chat' &&
      !parsed.options.noninteractive &&
      (parsed.options.interactive || process.stdin.isTTY)
    ) {
      try {
        const sessionId = parsed.options.session as string | undefined;
        await startInteractiveChat(context, sessionId);
        return 0;
      } catch (error) {
        console.error('Chat error:', error);
        return 1;
      }
    }

    // Execute command
    const result = await executeCommand(parsed.command, parsed.args, context);

    // Output result
    const output = parsed.options.output as string;
    if (output === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.message);
    }

    return result.success ? 0 : 1;
  }

  /**
   * Show help information
   */
  showHelp(): void {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗              ║
║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝              ║
║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗              ║
║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║              ║
║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║              ║
║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝              ║
║                                                              ║
║   Intelligent AI Agent Framework                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

USAGE
  nexus <command> [options]

COMMANDS`);

    // List all commands
    for (const [name, cmd] of commands) {
      if (name !== 'help' && name !== 'version') {
        console.log(`  ${name.padEnd(12)}${cmd.description}`);
      }
    }

    console.log(`
OPTIONS
  -h, --help         Show this help message
  -v, --version      Show version information
  -d, --debug        Enable debug mode
  -c, --config       Path to config directory
  -s, --session      Session ID for session operations
  -i, --interactive  Force interactive mode
  -n, --noninteractive  Run in non-interactive mode
  -o, --output       Output format (text, json)

EXAMPLES
  # Initialize a new project
  nexus init my-project

  # Start the agent
  nexus start

  # Interactive chat
  nexus chat

  # Run with specific session
  nexus chat -s session-123

  # Create a new skill
  nexus forge skill data-processor

  # Run dream cycle
  nexus dream --deep

  # Self-reflection
  nexus reflect

ENVIRONMENT VARIABLES
  NEXUS_HOME            Home directory (default: ~/.nexus)
  NEXUS_PRIMARY_MODEL   Primary LLM model
  NEXUS_UTILITY_MODEL   Utility model for summarization
  NEXUS_MAX_TOKENS      Maximum response tokens
  NEXUS_TEMPERATURE     Response temperature
  NEXUS_DEBUG           Enable debug mode

DOCUMENTATION
  https://github.com/nexus-ai/nexus-cli

`);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function main(): Promise<number> {
  const cli = new NexusCLI({
    debug: process.env.NEXUS_DEBUG === 'true' || process.argv.includes('--debug'),
  });

  try {
    return await cli.run(process.argv);
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    return 1;
  }
}

// Export for programmatic use
export {
  NexusCLI,
  ConfigManager,
  SessionManager,
  NodeExecutor,
  PipelineBuilder,
  SkillLoader,
  MemoryManager,
  ToolRegistry,
  executeCommand,
  startInteractiveChat,
};

// Run if called directly
if (import.meta.main) {
  main().then(code => process.exit(code));
}

export default NexusCLI;
