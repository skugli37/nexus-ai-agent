/**
 * NEXUS Code Execute Tool
 * 
 * This tool allows NEXUS to execute code and modify its own files.
 * It provides REAL file operations, not simulations.
 */

import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync, readdirSync, statSync, appendFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface CodeExecuteParams {
  action: 'create_file' | 'read_file' | 'modify_file' | 'delete_file' | 'append_file' | 'list_dir' | 'run_command' | 'run_code';
  path?: string;
  content?: string;
  code?: string;
  language?: string;
  command?: string;
  cwd?: string;
  oldContent?: string;
  newContent?: string;
  encoding?: BufferEncoding;
}

export interface CodeExecuteResult {
  success: boolean;
  action: string;
  result?: unknown;
  error?: string;
  timestamp: string;
  duration: number;
}

// ============================================================================
// Code Execute Tool
// ============================================================================

export class CodeExecuteTool {
  private basePath: string;
  private allowedPaths: string[];

  constructor(basePath: string = '/home/z/my-project/nexus') {
    this.basePath = basePath;
    this.allowedPaths = [
      '/home/z/my-project/nexus',
      '/home/z/my-project/download',
      '/tmp/nexus-sandbox'
    ];
  }

  /**
   * Execute a code action
   */
  async execute(params: CodeExecuteParams): Promise<CodeExecuteResult> {
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (params.action) {
        case 'create_file':
          result = await this.createFile(params);
          break;
        case 'read_file':
          result = await this.readFile(params);
          break;
        case 'modify_file':
          result = await this.modifyFile(params);
          break;
        case 'delete_file':
          result = await this.deleteFile(params);
          break;
        case 'append_file':
          result = await this.appendFile(params);
          break;
        case 'list_dir':
          result = await this.listDir(params);
          break;
        case 'run_command':
          result = await this.runCommand(params);
          break;
        case 'run_code':
          result = await this.runCode(params);
          break;
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }

      return {
        success: true,
        action: params.action,
        result,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        action: params.action,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Validate path is within allowed directories
   */
  private validatePath(path: string): boolean {
    const resolvedPath = path.startsWith('/') ? path : join(this.basePath, path);
    return this.allowedPaths.some(allowed => resolvedPath.startsWith(allowed));
  }

  /**
   * Resolve path relative to base
   */
  private resolvePath(path: string): string {
    return path.startsWith('/') ? path : join(this.basePath, path);
  }

  /**
   * Create a new file
   */
  private async createFile(params: CodeExecuteParams): Promise<unknown> {
    if (!params.path) throw new Error('Path is required');
    if (params.content === undefined) throw new Error('Content is required');

    const filePath = this.resolvePath(params.path);
    if (!this.validatePath(filePath)) {
      throw new Error(`Path not allowed: ${filePath}`);
    }

    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, params.content, params.encoding || 'utf-8');

    return {
      created: true,
      path: filePath,
      size: params.content.length
    };
  }

  /**
   * Read a file
   */
  private async readFile(params: CodeExecuteParams): Promise<unknown> {
    if (!params.path) throw new Error('Path is required');

    const filePath = this.resolvePath(params.path);
    if (!this.validatePath(filePath)) {
      throw new Error(`Path not allowed: ${filePath}`);
    }

    if (!existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const content = readFileSync(filePath, params.encoding || 'utf-8');

    return {
      path: filePath,
      content,
      size: content.length
    };
  }

  /**
   * Modify a file (replace content)
   */
  private async modifyFile(params: CodeExecuteParams): Promise<unknown> {
    if (!params.path) throw new Error('Path is required');
    if (!params.oldContent && params.newContent === undefined) {
      throw new Error('Either oldContent/newContent or content is required');
    }

    const filePath = this.resolvePath(params.path);
    if (!this.validatePath(filePath)) {
      throw new Error(`Path not allowed: ${filePath}`);
    }

    if (!existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    let content = readFileSync(filePath, params.encoding || 'utf-8');
    const originalContent = content;

    if (params.oldContent && params.newContent !== undefined) {
      // Replace old content with new content
      if (!content.includes(params.oldContent)) {
        throw new Error('oldContent not found in file');
      }
      content = content.replace(params.oldContent, params.newContent);
    } else if (params.content !== undefined) {
      // Replace entire content
      content = params.content;
    }

    writeFileSync(filePath, content, params.encoding || 'utf-8');

    return {
      modified: true,
      path: filePath,
      oldSize: originalContent.length,
      newSize: content.length
    };
  }

  /**
   * Delete a file
   */
  private async deleteFile(params: CodeExecuteParams): Promise<unknown> {
    if (!params.path) throw new Error('Path is required');

    const filePath = this.resolvePath(params.path);
    if (!this.validatePath(filePath)) {
      throw new Error(`Path not allowed: ${filePath}`);
    }

    if (!existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    unlinkSync(filePath);

    return {
      deleted: true,
      path: filePath
    };
  }

  /**
   * Append to a file
   */
  private async appendFile(params: CodeExecuteParams): Promise<unknown> {
    if (!params.path) throw new Error('Path is required');
    if (params.content === undefined) throw new Error('Content is required');

    const filePath = this.resolvePath(params.path);
    if (!this.validatePath(filePath)) {
      throw new Error(`Path not allowed: ${filePath}`);
    }

    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    appendFileSync(filePath, params.content, params.encoding || 'utf-8');

    return {
      appended: true,
      path: filePath,
      addedSize: params.content.length
    };
  }

  /**
   * List directory contents
   */
  private async listDir(params: CodeExecuteParams): Promise<unknown> {
    const dirPath = params.path ? this.resolvePath(params.path) : this.basePath;
    if (!this.validatePath(dirPath)) {
      throw new Error(`Path not allowed: ${dirPath}`);
    }

    if (!existsSync(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const entries = readdirSync(dirPath);
    const files = entries.map(name => {
      const fullPath = join(dirPath, name);
      const stats = statSync(fullPath);
      return {
        name,
        path: fullPath,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        modified: stats.mtime
      };
    });

    return {
      path: dirPath,
      entries: files,
      count: files.length
    };
  }

  /**
   * Run a shell command
   */
  private async runCommand(params: CodeExecuteParams): Promise<unknown> {
    if (!params.command) throw new Error('Command is required');

    const cwd = params.cwd ? this.resolvePath(params.cwd) : this.basePath;
    if (!this.validatePath(cwd)) {
      throw new Error(`Working directory not allowed: ${cwd}`);
    }

    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd,
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024
      });

      return {
        command: params.command,
        cwd,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0
      };
    } catch (error: any) {
      return {
        command: params.command,
        cwd,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.code || 1
      };
    }
  }

  /**
   * Run JavaScript/TypeScript code
   */
  private async runCode(params: CodeExecuteParams): Promise<unknown> {
    if (!params.code) throw new Error('Code is required');

    const language = params.language || 'javascript';

    // For JavaScript, execute in sandbox
    if (language === 'javascript' || language === 'js') {
      const startTime = Date.now();
      try {
        // Create a sandboxed function
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('fs', 'path', 'console', 'require', 
          params.code
        );

        // Capture console output
        const logs: string[] = [];
        const mockConsole = {
          log: (...args: any[]) => logs.push(args.map(a => String(a)).join(' ')),
          error: (...args: any[]) => logs.push('[ERROR] ' + args.map(a => String(a)).join(' ')),
          warn: (...args: any[]) => logs.push('[WARN] ' + args.map(a => String(a)).join(' '))
        };

        const result = await fn(
          { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync, mkdirSync },
          { join, dirname, basename, extname },
          mockConsole,
          (mod: string) => {
            // Allow only safe modules
            if (['fs', 'path', 'util', 'crypto', 'os'].includes(mod)) {
              return require(mod);
            }
            throw new Error(`Module '${mod}' not allowed in sandbox`);
          }
        );

        return {
          executed: true,
          language,
          result,
          logs,
          duration: Date.now() - startTime
        };

      } catch (error) {
        return {
          executed: false,
          language,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        };
      }
    }

    // For TypeScript, transpile and run
    if (language === 'typescript' || language === 'ts') {
      // Write to temp file and run with bun
      const tempFile = `/tmp/nexus-sandbox/${Date.now()}.ts`;
      if (!existsSync('/tmp/nexus-sandbox')) {
        mkdirSync('/tmp/nexus-sandbox', { recursive: true });
      }
      writeFileSync(tempFile, params.code);

      try {
        const { stdout, stderr } = await execAsync(`bun run ${tempFile}`, {
          timeout: 30000
        });

        return {
          executed: true,
          language,
          stdout,
          stderr,
          duration: Date.now() - startTime
        };
      } catch (error: any) {
        return {
          executed: false,
          language,
          error: error.message,
          stdout: error.stdout || '',
          stderr: error.stderr || ''
        };
      } finally {
        if (existsSync(tempFile)) {
          unlinkSync(tempFile);
        }
      }
    }

    throw new Error(`Unsupported language: ${language}`);
  }
}

// Export singleton instance
export const codeExecuteTool = new CodeExecuteTool();
export default codeExecuteTool;
