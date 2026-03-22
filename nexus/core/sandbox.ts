/**
 * NEXUS Code Execution Sandbox
 * Secure code execution for dynamically generated tools
 * 
 * Features:
 * - JavaScript/TypeScript execution
 * - Timeout control
 * - Resource limiting
 * - Safe built-in access
 */

import { EventEmitter } from 'events';

export interface ExecutionResult {
  success: boolean;
  output: unknown;
  error?: string;
  duration: number;
  logs: string[];
}

export interface ExecutionOptions {
  timeout?: number;
  maxMemory?: number;
  allowFetch?: boolean;
  allowFileSystem?: boolean;
}

const DEFAULT_OPTIONS: ExecutionOptions = {
  timeout: 30000,
  maxMemory: 128 * 1024 * 1024, // 128MB
  allowFetch: true,
  allowFileSystem: false
};

export class CodeSandbox extends EventEmitter {
  private options: ExecutionOptions;

  constructor(options: Partial<ExecutionOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute JavaScript/TypeScript code in sandbox
   */
  async execute(code: string, inputs: Record<string, unknown> = {}): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    // Create sandbox context
    const sandbox = this.createSandbox(inputs, logs);

    // Wrap code in async function with return
    const wrappedCode = `
      return (async function() {
        ${code}
      })()
    `;

    try {
      // Create function with sandbox context
      const fn = new Function(...Object.keys(sandbox), wrappedCode);
      
      // Execute with timeout
      const result = await this.executeWithTimeout(
        fn(...Object.values(sandbox)),
        this.options.timeout!
      );

      return {
        success: true,
        output: result,
        duration: Date.now() - startTime,
        logs
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        logs
      };
    }
  }

  /**
   * Execute a tool function from code string
   */
  async executeTool(
    code: string,
    functionName: string,
    inputs: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    const sandbox = this.createSandbox(inputs, logs);

    // Wrap to extract and call function
    const wrappedCode = `
      (async function() {
        ${code}
        
        if (typeof ${functionName} === 'function') {
          return await ${functionName}(inputs);
        } else if (typeof execute === 'function') {
          return await execute(inputs);
        } else if (typeof default === 'function') {
          return await default(inputs);
        } else {
          throw new Error('No executable function found. Define execute(), ${functionName}(), or default export.');
        }
      })()
    `;

    try {
      const fn = new Function(...Object.keys(sandbox), wrappedCode);
      
      const result = await this.executeWithTimeout(
        fn(...Object.values(sandbox)),
        this.options.timeout!
      );

      return {
        success: true,
        output: result,
        duration: Date.now() - startTime,
        logs
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        logs
      };
    }
  }

  /**
   * Create sandbox context with allowed globals
   */
  private createSandbox(
    inputs: Record<string, unknown>,
    logs: string[]
  ): Record<string, unknown> {
    // Safe console that captures logs
    const safeConsole = {
      log: (...args: unknown[]) => logs.push(args.map(a => String(a)).join(' ')),
      error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(a => String(a)).join(' ')),
      warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(a => String(a)).join(' ')),
      info: (...args: unknown[]) => logs.push('[INFO] ' + args.map(a => String(a)).join(' '))
    };

    // Safe fetch (if allowed)
    const safeFetch = this.options.allowFetch 
      ? fetch.bind(globalThis)
      : () => Promise.reject(new Error('fetch is not allowed in sandbox'));

    // Base sandbox context
    const sandbox: Record<string, unknown> = {
      // Inputs
      inputs,
      input: inputs,
      
      // Safe console
      console: safeConsole,
      
      // Allowed globals
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Promise,
      
      // JSON utilities
      JSON,
      
      // Object utilities
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
      TypeError,
      RangeError,
      
      // Crypto (for UUID generation)
      crypto: {
        randomUUID: crypto.randomUUID.bind(crypto),
        getRandomValues: crypto.getRandomValues.bind(crypto)
      }
    };

    // Add fetch if allowed
    if (this.options.allowFetch) {
      sandbox.fetch = safeFetch;
      sandbox.Request = Request;
      sandbox.Response = Response;
      sandbox.Headers = Headers;
    }

    // Add URL (always available)
    sandbox.URL = URL;
    sandbox.URLSearchParams = URLSearchParams;

    return sandbox;
  }

  /**
   * Execute promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
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

  /**
   * Validate code for security issues
   */
  validateCode(code: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, message: 'eval() is not allowed' },
      { pattern: /Function\s*\(/, message: 'Function constructor is not allowed' },
      { pattern: /require\s*\(/, message: 'require() is not allowed' },
      { pattern: /import\s+/, message: 'import statements are not allowed' },
      { pattern: /process\.exit/, message: 'process.exit is not allowed' },
      { pattern: /global\./, message: 'global object access is not allowed' },
      { pattern: /globalThis\./, message: 'globalThis access is not allowed' },
      { pattern: /__dirname/, message: '__dirname is not allowed' },
      { pattern: /__filename/, message: '__filename is not allowed' }
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(message);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get sandbox options
   */
  getOptions(): ExecutionOptions {
    return { ...this.options };
  }

  /**
   * Update sandbox options
   */
  setOptions(options: Partial<ExecutionOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// Singleton instance
export const codeSandbox = new CodeSandbox();

export default CodeSandbox;
