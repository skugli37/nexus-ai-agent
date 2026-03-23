/**
 * NEXUS API - Code Execute Endpoint
 * Full implementation with file system operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const SANDBOX_ROOT = join(homedir(), '.nexus', 'sandbox');

// Ensure sandbox directory exists
if (!existsSync(SANDBOX_ROOT)) {
  mkdirSync(SANDBOX_ROOT, { recursive: true });
}

// Dangerous patterns to block
const DANGEROUS_PATTERNS = [
  /eval\s*\(/,
  /Function\s*\(/,
  /process\.exit/,
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /import\s+.*['"]child_process['"]/,
  /__dirname/,
  /__filename/,
  /process\.env/,
  /global\./,
  /globalThis\./,
];

interface ExecuteRequest {
  code: string;
  language?: 'javascript' | 'typescript' | 'python';
  inputs?: Record<string, unknown>;
  files?: Array<{ path: string; content: string }>;
  outputPath?: string;
  timeout?: number;
}

/**
 * POST /api/nexus/execute
 * Execute code in sandbox with file operations
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExecuteRequest = await request.json();
    const { 
      code, 
      language = 'javascript',
      inputs = {},
      files = [],
      outputPath,
      timeout = 30000 
    } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Code is required' },
        { status: 400 }
      );
    }

    // Validate code for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Code contains forbidden patterns for security',
            pattern: pattern.source 
          },
          { status: 400 }
        );
      }
    }

    // Create files if specified
    const createdFiles: string[] = [];
    for (const file of files) {
      // Validate path (no traversal)
      if (file.path.includes('..')) {
        continue;
      }
      
      const filePath = join(SANDBOX_ROOT, file.path);
      const dir = join(filePath, '..');
      
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      writeFileSync(filePath, file.content);
      createdFiles.push(file.path);
    }

    // Execute code in sandbox
    const startTime = Date.now();
    const logs: string[] = [];
    
    // Create sandbox context
    const sandboxContext: Record<string, unknown> = {
      inputs,
      input: inputs,
      console: {
        log: (...args: unknown[]) => logs.push(['LOG', ...args].join(' ')),
        error: (...args: unknown[]) => logs.push(['ERROR', ...args].join(' ')),
        warn: (...args: unknown[]) => logs.push(['WARN', ...args].join(' ')),
        info: (...args: unknown[]) => logs.push(['INFO', ...args].join(' ')),
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Promise,
      JSON,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      Math,
      Map,
      Set,
      RegExp,
      Error,
      URL,
      URLSearchParams,
      crypto: {
        randomUUID: crypto.randomUUID,
        getRandomValues: crypto.getRandomValues,
      },
      fetch: globalThis.fetch,
      Request: globalThis.Request,
      Response: globalThis.Response,
      Headers: globalThis.Headers,
      // File system operations (sandboxed)
      fs: {
        writeFile: (path: string, content: string) => {
          if (path.includes('..')) throw new Error('Path traversal not allowed');
          const fullPath = join(SANDBOX_ROOT, path);
          writeFileSync(fullPath, content);
          return { success: true, path };
        },
        readFile: (path: string) => {
          if (path.includes('..')) throw new Error('Path traversal not allowed');
          const fullPath = join(SANDBOX_ROOT, path);
          if (!existsSync(fullPath)) throw new Error('File not found');
          return readFileSync(fullPath, 'utf-8');
        },
        exists: (path: string) => {
          if (path.includes('..')) return false;
          return existsSync(join(SANDBOX_ROOT, path));
        },
        mkdir: (path: string) => {
          if (path.includes('..')) throw new Error('Path traversal not allowed');
          mkdirSync(join(SANDBOX_ROOT, path), { recursive: true });
          return { success: true, path };
        },
        listDir: (path: string = '') => {
          if (path.includes('..')) throw new Error('Path traversal not allowed');
          const fullPath = join(SANDBOX_ROOT, path);
          if (!existsSync(fullPath)) return [];
          return readdirSync(fullPath);
        },
        deleteFile: (path: string) => {
          if (path.includes('..')) throw new Error('Path traversal not allowed');
          const fullPath = join(SANDBOX_ROOT, path);
          if (existsSync(fullPath)) {
            unlinkSync(fullPath);
            return true;
          }
          return false;
        },
        stat: (path: string) => {
          if (path.includes('..')) throw new Error('Path traversal not allowed');
          const fullPath = join(SANDBOX_ROOT, path);
          if (!existsSync(fullPath)) return null;
          const s = statSync(fullPath);
          return {
            size: s.size,
            isFile: s.isFile(),
            isDirectory: s.isDirectory(),
            created: s.birthtime,
            modified: s.mtime,
          };
        }
      },
      path: {
        join: (...parts: string[]) => parts.join('/'),
        basename,
      },
      sandboxRoot: SANDBOX_ROOT,
    };

    try {
      // Wrap code in async function
      const wrappedCode = `
        return (async function() {
          ${code}
        })()
      `;

      // Create function with sandbox context
      const fn = new Function(...Object.keys(sandboxContext), wrappedCode);
      
      // Execute with timeout
      const result = await executeWithTimeout(
        fn(...Object.values(sandboxContext)),
        timeout
      );

      const duration = Date.now() - startTime;

      // Write output file if specified
      if (outputPath && result !== undefined) {
        const outPath = join(SANDBOX_ROOT, outputPath);
        writeFileSync(outPath, typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      }

      return NextResponse.json({
        success: true,
        output: result,
        logs,
        duration,
        filesCreated: createdFiles,
        sandboxPath: SANDBOX_ROOT,
      });

    } catch (execError) {
      const duration = Date.now() - startTime;
      
      return NextResponse.json({
        success: false,
        error: execError instanceof Error ? execError.message : 'Execution failed',
        logs,
        duration,
        filesCreated: createdFiles,
        sandboxPath: SANDBOX_ROOT,
      });
    }

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/nexus/execute
 * List sandbox files
 */
export async function GET() {
  try {
    const files = listFilesRecursive(SANDBOX_ROOT);
    
    return NextResponse.json({
      sandboxPath: SANDBOX_ROOT,
      fileCount: files.length,
      files: files.map(f => ({
        path: f.relativePath,
        fullPath: f.fullPath,
        size: f.size,
        modified: f.modified,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/nexus/execute
 * Delete a sandbox file
 */
export async function DELETE(request: NextRequest) {
  try {
    const { path } = await request.json();
    
    if (!path || path.includes('..')) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }
    
    const fullPath = join(SANDBOX_ROOT, path);
    
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
      return NextResponse.json({ success: true, deleted: path });
    }
    
    return NextResponse.json(
      { success: false, error: 'File not found' },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Delete failed' },
      { status: 500 }
    );
  }
}

// Helper: Execute with timeout
function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// Helper: List files recursively
function listFilesRecursive(dir: string, baseDir: string = dir): Array<{
  relativePath: string;
  fullPath: string;
  size: number;
  modified: Date;
}> {
  const files: Array<{
    relativePath: string;
    fullPath: string;
    size: number;
    modified: Date;
  }> = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, baseDir));
    } else {
      const stat = statSync(fullPath);
      files.push({
        relativePath: fullPath.slice(baseDir.length + 1),
        fullPath,
        size: stat.size,
        modified: stat.mtime,
      });
    }
  }

  return files;
}
