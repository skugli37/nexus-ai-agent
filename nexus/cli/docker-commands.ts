/**
 * NEXUS Docker CLI Commands
 * 
 * Full-featured Docker management commands with support for:
 * - Container lifecycle management
 * - Code execution in containers
 * - Image building and management
 * - Container stats monitoring
 * - Output formatting (json, yaml, table)
 */

import { CommandResult, CommandContext, commands } from './commands';
import {
  DockerSandbox,
  DockerContainerConfig,
  DockerExecutionResult,
  ContainerStats,
  ContainerInfo,
  DockerNotAvailableError,
} from '../core/docker-sandbox';

// ============================================================================
// Types
// ============================================================================

export interface DockerCommandOptions {
  output?: 'json' | 'yaml' | 'table' | 'text';
  verbose?: boolean;
}

type DockerCommandHandler = (
  args: string[],
  context: CommandContext,
  options: DockerCommandOptions
) => Promise<CommandResult>;

interface DockerCommand {
  name: string;
  description: string;
  usage: string;
  handler: DockerCommandHandler;
}

// ============================================================================
// Color Utilities (Simple implementation without chalk dependency)
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const colorize = {
  success: (text: string) => `${colors.green}✓${colors.reset} ${text}`,
  error: (text: string) => `${colors.red}✗${colors.reset} ${text}`,
  warning: (text: string) => `${colors.yellow}⚠${colors.reset} ${text}`,
  info: (text: string) => `${colors.blue}ℹ${colors.reset} ${text}`,
  highlight: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
  bold: (text: string) => `${colors.bold}${text}${colors.reset}`,
};

// ============================================================================
// Output Formatters
// ============================================================================

function formatOutput(data: unknown, format: string = 'text'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return objectToYaml(data);
    case 'table':
      return formatTable(data);
    default:
      if (typeof data === 'string') return data;
      return JSON.stringify(data, null, 2);
  }
}

function objectToYaml(obj: unknown, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null || obj === undefined) return 'null\n';
  if (typeof obj !== 'object') return String(obj) + '\n';
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]\n';
    let result = '\n';
    for (const item of obj) {
      result += `${spaces}- ${objectToYaml(item, indent + 1).trim()}\n`;
    }
    return result;
  }
  
  let result = indent === 0 ? '' : '\n';
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'object' && value !== null) {
      result += `${spaces}${key}:${objectToYaml(value, indent + 1)}`;
    } else {
      result += `${spaces}${key}: ${value}\n`;
    }
  }
  return result;
}

function formatTable(data: unknown): string {
  if (!Array.isArray(data)) {
    return formatOutput(data, 'json');
  }
  
  if (data.length === 0) return 'No data\n';
  
  // Get all unique keys
  const keys = new Set<string>();
  for (const item of data) {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(k => keys.add(k));
    }
  }
  
  const headers = Array.from(keys);
  const colWidths = headers.map(h => Math.max(h.length, 10));
  
  // Calculate column widths
  for (const item of data) {
    if (typeof item === 'object' && item !== null) {
      for (let i = 0; i < headers.length; i++) {
        const val = String((item as Record<string, unknown>)[headers[i]] ?? '');
        colWidths[i] = Math.max(colWidths[i], Math.min(val.length, 40));
      }
    }
  }
  
  // Build table
  let result = '';
  
  // Header
  result += '┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐\n';
  result += '│' + headers.map((h, i) => ` ${colorize.bold(h.padEnd(colWidths[i]))} `).join('│') + '│\n';
  result += '├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤\n';
  
  // Rows
  for (const item of data) {
    if (typeof item === 'object' && item !== null) {
      const row = item as Record<string, unknown>;
      result += '│' + headers.map((h, i) => {
        const val = String(row[h] ?? '-');
        const truncated = val.length > colWidths[i] ? val.slice(0, colWidths[i] - 3) + '...' : val;
        return ` ${truncated.padEnd(colWidths[i])} `;
      }).join('│') + '│\n';
    }
  }
  
  result += '└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘\n';
  
  return result;
}

// ============================================================================
// Docker Sandbox Instance
// ============================================================================

let dockerSandbox: DockerSandbox | null = null;

function getDockerSandbox(): DockerSandbox {
  if (!dockerSandbox) {
    dockerSandbox = new DockerSandbox({
      defaultTimeout: 60000,
      defaultMemoryLimit: '512m',
      defaultCpuLimit: 0.5,
    });
  }
  return dockerSandbox;
}

// ============================================================================
// Docker Commands
// ============================================================================

const dockerCommands: DockerCommand[] = [
  // ==========================================================================
  // docker:create - Create a new container
  // ==========================================================================
  {
    name: 'docker:create',
    description: 'Create a new Docker container',
    usage: 'nexus docker:create <image> [options]\n\nOptions:\n  --name <name>       Container name\n  --cpu <limit>       CPU limit (e.g., 0.5)\n  --memory <limit>    Memory limit (e.g., 512m)\n  --timeout <ms>      Timeout in milliseconds\n  --network <mode>    Network mode (none, bridge, host)',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        // Check Docker availability
        const available = await sandbox.isAvailable();
        if (!available) {
          return {
            success: false,
            message: colorize.error('Docker daemon is not available. Please start Docker.'),
          };
        }
        
        // Parse arguments
        const image = args[0];
        if (!image) {
          return {
            success: false,
            message: 'Usage: nexus docker:create <image> [options]',
          };
        }
        
        const config: DockerContainerConfig = { image };
        
        // Parse options
        for (let i = 1; i < args.length; i++) {
          switch (args[i]) {
            case '--name':
              config.name = args[++i];
              break;
            case '--cpu':
              config.cpuLimit = parseFloat(args[++i]);
              break;
            case '--memory':
              config.memoryLimit = args[++i];
              break;
            case '--timeout':
              config.timeout = parseInt(args[++i]);
              break;
            case '--network':
              config.network = args[++i] as 'none' | 'bridge' | 'host';
              break;
          }
        }
        
        if (options.verbose) {
          console.log(colorize.dim(`Creating container from image: ${image}`));
        }
        
        const containerId = await sandbox.createContainer(config);
        
        const result = {
          containerId,
          image,
          name: config.name || containerId.slice(0, 12),
          status: 'created',
        };
        
        return {
          success: true,
          message: colorize.success(`Container created: ${containerId.slice(0, 12)}`),
          data: result,
        };
      } catch (error) {
        if (error instanceof DockerNotAvailableError) {
          return {
            success: false,
            message: colorize.error('Docker daemon is not available'),
          };
        }
        return {
          success: false,
          message: colorize.error(`Failed to create container: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },

  // ==========================================================================
  // docker:exec - Execute command in container
  // ==========================================================================
  {
    name: 'docker:exec',
    description: 'Execute a command in a running container',
    usage: 'nexus docker:exec <container-id> <command...>',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        const containerId = args[0];
        const command = args.slice(1);
        
        if (!containerId || command.length === 0) {
          return {
            success: false,
            message: 'Usage: nexus docker:exec <container-id> <command...>',
          };
        }
        
        if (options.verbose) {
          console.log(colorize.dim(`Executing in container ${containerId.slice(0, 12)}: ${command.join(' ')}`));
        }
        
        const result = await sandbox.execute(containerId, command);
        
        const output: string[] = [];
        
        if (result.stdout) {
          output.push(result.stdout);
        }
        
        if (result.stderr) {
          output.push(colorize.warning(result.stderr));
        }
        
        return {
          success: result.exitCode === 0,
          message: output.join('\n') || colorize.info('Command completed with no output'),
          data: {
            containerId,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration: result.duration,
          },
        };
      } catch (error) {
        return {
          success: false,
          message: colorize.error(`Execution failed: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },

  // ==========================================================================
  // docker:code - Execute code in container
  // ==========================================================================
  {
    name: 'docker:code',
    description: 'Execute code (Python/Node.js/Bash) in a container',
    usage: 'nexus docker:code <container-id> <language> <code>\n\nLanguages: python, nodejs, bash\n\nExample:\n  nexus docker:code abc123 python "print(\'Hello World\')"',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        const containerId = args[0];
        const language = args[1] as 'python' | 'nodejs' | 'bash';
        const code = args.slice(2).join(' ');
        
        if (!containerId || !language || !code) {
          return {
            success: false,
            message: 'Usage: nexus docker:code <container-id> <language> <code>',
          };
        }
        
        if (!['python', 'nodejs', 'bash'].includes(language)) {
          return {
            success: false,
            message: colorize.error(`Invalid language: ${language}. Use python, nodejs, or bash.`),
          };
        }
        
        if (options.verbose) {
          console.log(colorize.dim(`Executing ${language} code in container ${containerId.slice(0, 12)}`));
        }
        
        const result = await sandbox.executeCode(containerId, code, language);
        
        const output: string[] = [];
        
        if (result.stdout) {
          output.push(`${colors.cyan}Output:${colors.reset}\n${result.stdout}`);
        }
        
        if (result.stderr) {
          output.push(`${colors.yellow}Stderr:${colors.reset}\n${result.stderr}`);
        }
        
        output.push(`\n${colors.dim}Exit code: ${result.exitCode} | Duration: ${result.duration}ms${colors.reset}`);
        
        return {
          success: result.exitCode === 0,
          message: output.join('\n'),
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          message: colorize.error(`Code execution failed: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },

  // ==========================================================================
  // docker:stop - Stop a container
  // ==========================================================================
  {
    name: 'docker:stop',
    description: 'Stop a running container',
    usage: 'nexus docker:stop <container-id> [--timeout <seconds>]',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        const containerId = args[0];
        if (!containerId) {
          return {
            success: false,
            message: 'Usage: nexus docker:stop <container-id>',
          };
        }
        
        let timeout = 10;
        const timeoutIdx = args.indexOf('--timeout');
        if (timeoutIdx !== -1) {
          timeout = parseInt(args[timeoutIdx + 1]) || 10;
        }
        
        if (options.verbose) {
          console.log(colorize.dim(`Stopping container ${containerId.slice(0, 12)} (timeout: ${timeout}s)`));
        }
        
        await sandbox.stopContainer(containerId, timeout);
        
        return {
          success: true,
          message: colorize.success(`Container stopped: ${containerId.slice(0, 12)}`),
          data: { containerId, status: 'stopped' },
        };
      } catch (error) {
        return {
          success: false,
          message: colorize.error(`Failed to stop container: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },

  // ==========================================================================
  // docker:remove - Remove a container
  // ==========================================================================
  {
    name: 'docker:remove',
    description: 'Remove a container',
    usage: 'nexus docker:remove <container-id> [--force]',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        const containerId = args[0];
        if (!containerId) {
          return {
            success: false,
            message: 'Usage: nexus docker:remove <container-id>',
          };
        }
        
        const force = args.includes('--force');
        
        if (options.verbose) {
          console.log(colorize.dim(`Removing container ${containerId.slice(0, 12)}${force ? ' (force)' : ''}`));
        }
        
        await sandbox.removeContainer(containerId, force);
        
        return {
          success: true,
          message: colorize.success(`Container removed: ${containerId.slice(0, 12)}`),
          data: { containerId, removed: true },
        };
      } catch (error) {
        return {
          success: false,
          message: colorize.error(`Failed to remove container: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },

  // ==========================================================================
  // docker:list - List containers
  // ==========================================================================
  {
    name: 'docker:list',
    description: 'List all NEXUS-managed Docker containers',
    usage: 'nexus docker:list [--all] [--output <format>]',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        const available = await sandbox.isAvailable();
        if (!available) {
          return {
            success: false,
            message: colorize.error('Docker daemon is not available'),
          };
        }
        
        const all = args.includes('--all');
        const containers = await sandbox.listContainers(all);
        
        if (containers.length === 0) {
          return {
            success: true,
            message: colorize.info('No containers found'),
            data: [],
          };
        }
        
        const outputFormat = options.output || 'table';
        
        const formattedContainers = containers.map(c => ({
          id: c.id.slice(0, 12),
          name: c.name,
          image: c.image,
          status: c.status,
          created: c.created.toISOString().split('T')[0],
        }));
        
        if (outputFormat === 'table') {
          let message = `\n${colorize.bold('NEXUS Docker Containers')}\n\n`;
          message += formatTable(formattedContainers);
          return {
            success: true,
            message,
            data: containers,
          };
        }
        
        return {
          success: true,
          message: formatOutput(formattedContainers, outputFormat),
          data: containers,
        };
      } catch (error) {
        return {
          success: false,
          message: colorize.error(`Failed to list containers: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },

  // ==========================================================================
  // docker:build - Build an image
  // ==========================================================================
  {
    name: 'docker:build',
    description: 'Build a Docker image from a Dockerfile',
    usage: 'nexus docker:build <dockerfile-path> <tag> [--context <path>]',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        const dockerfilePath = args[0];
        const tag = args[1];
        
        if (!dockerfilePath || !tag) {
          return {
            success: false,
            message: 'Usage: nexus docker:build <dockerfile-path> <tag>',
          };
        }
        
        const contextIdx = args.indexOf('--context');
        const contextPath = contextIdx !== -1 ? args[contextIdx + 1] : undefined;
        
        if (options.verbose) {
          console.log(colorize.dim(`Building image: ${tag}`));
          console.log(colorize.dim(`Dockerfile: ${dockerfilePath}`));
        }
        
        // Read Dockerfile content
        const { readFileSync } = await import('fs');
        const dockerfile = readFileSync(dockerfilePath, 'utf-8');
        
        const imageId = await sandbox.buildImage(dockerfile, tag, contextPath);
        
        return {
          success: true,
          message: colorize.success(`Image built: ${tag}`),
          data: { tag, imageId },
        };
      } catch (error) {
        return {
          success: false,
          message: colorize.error(`Failed to build image: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },

  // ==========================================================================
  // docker:pull - Pull an image
  // ==========================================================================
  {
    name: 'docker:pull',
    description: 'Pull a Docker image from registry',
    usage: 'nexus docker:pull <image>',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        const image = args[0];
        if (!image) {
          return {
            success: false,
            message: 'Usage: nexus docker:pull <image>',
          };
        }
        
        if (options.verbose) {
          console.log(colorize.dim(`Pulling image: ${image}`));
        }
        
        // Set up progress listener
        sandbox.on('image:pull:progress', (data: { image: string; status: string; progress?: string }) => {
          if (options.verbose) {
            process.stdout.write(`\r${colorize.dim(data.status)} ${data.progress || ''}`);
          }
        });
        
        await sandbox.pullImage(image);
        
        if (options.verbose) {
          console.log(''); // New line after progress
        }
        
        return {
          success: true,
          message: colorize.success(`Image pulled: ${image}`),
          data: { image, pulled: true },
        };
      } catch (error) {
        return {
          success: false,
          message: colorize.error(`Failed to pull image: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },

  // ==========================================================================
  // docker:stats - Get container stats
  // ==========================================================================
  {
    name: 'docker:stats',
    description: 'Get resource usage statistics for a container',
    usage: 'nexus docker:stats <container-id> [--output <format>]',
    handler: async (args, _context, options) => {
      try {
        const sandbox = getDockerSandbox();
        
        const containerId = args[0];
        if (!containerId) {
          return {
            success: false,
            message: 'Usage: nexus docker:stats <container-id>',
          };
        }
        
        const stats = await sandbox.getContainerStats(containerId);
        
        const outputFormat = options.output || 'text';
        
        if (outputFormat === 'json' || outputFormat === 'yaml') {
          return {
            success: true,
            message: formatOutput(stats, outputFormat),
            data: stats,
          };
        }
        
        // Format as nice text output
        const formatBytes = (bytes: number) => {
          if (bytes < 1024) return `${bytes}B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
          if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
          return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
        };
        
        let message = `\n${colorize.bold(`Container Stats: ${stats.name}`)}\n\n`;
        message += `${colors.cyan}CPU:${colors.reset}           ${stats.cpuPercent.toFixed(1)}%\n`;
        message += `${colors.cyan}Memory:${colors.reset}        ${formatBytes(stats.memoryUsage)} / ${formatBytes(stats.memoryLimit)} (${stats.memoryPercent.toFixed(1)}%)\n`;
        message += `${colors.cyan}Network I/O:${colors.reset}   ↓ ${formatBytes(stats.networkRx)} / ↑ ${formatBytes(stats.networkTx)}\n`;
        message += `${colors.cyan}Block I/O:${colors.reset}     Read ${formatBytes(stats.blockRead)} / Write ${formatBytes(stats.blockWrite)}\n`;
        message += `${colors.cyan}Processes:${colors.reset}     ${stats.pids}\n`;
        message += `${colors.cyan}Timestamp:${colors.reset}     ${stats.timestamp.toISOString()}\n`;
        
        return {
          success: true,
          message,
          data: stats,
        };
      } catch (error) {
        return {
          success: false,
          message: colorize.error(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`),
        };
      }
    },
  },
];

// ============================================================================
// Register Docker Commands
// ============================================================================

export function registerDockerCommands(): void {
  for (const cmd of dockerCommands) {
    commands.set(cmd.name, {
      description: cmd.description,
      usage: cmd.usage,
      handler: async (args: string[], context: CommandContext) => {
        // Parse global options
        const options: DockerCommandOptions = {
          output: 'text',
          verbose: args.includes('--verbose'),
        };
        
        const outputIdx = args.indexOf('--output');
        if (outputIdx !== -1) {
          options.output = args[outputIdx + 1] as DockerCommandOptions['output'];
        }
        
        return cmd.handler(args.filter(a => !a.startsWith('--')), context, options);
      },
    });
  }
}

// ============================================================================
// Docker Command Helper
// ============================================================================

export async function executeDockerCommand(
  command: string,
  args: string[],
  context: CommandContext,
  options: DockerCommandOptions = {}
): Promise<CommandResult> {
  const cmd = dockerCommands.find(c => c.name === command);
  
  if (!cmd) {
    return {
      success: false,
      message: `Unknown Docker command: ${command}`,
    };
  }
  
  return cmd.handler(args, context, options);
}

// ============================================================================
// Exports
// ============================================================================

export {
  dockerCommands,
  getDockerSandbox,
  formatOutput,
  colorize,
  colors,
};
