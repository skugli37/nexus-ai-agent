/**
 * NEXUS Code Node Executor
 * 
 * Executes JavaScript/TypeScript code in a sandboxed environment
 * Uses the CodeSandbox for safe execution
 */

import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';
import { CodeSandbox } from '../../sandbox';

export class CodeNodeExecutor extends NodeExecutor<'code'> {
  readonly type = 'code' as const;
  private sandbox: CodeSandbox;

  constructor(options?: { timeout?: number; allowFetch?: boolean }) {
    super();
    this.sandbox = new CodeSandbox({
      timeout: options?.timeout || 30000,
      allowFetch: options?.allowFetch ?? true,
      allowFileSystem: false
    });
  }

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const language = node.config.codeLanguage || 'javascript';
    const code = node.config.codeScript;

    if (!code) {
      return this.failure(
        node.id,
        'Code script not specified',
        Date.now() - startTime,
        context.retryCount
      );
    }

    // Only JavaScript/TypeScript supported
    if (language !== 'javascript' && language !== 'typescript' && language !== 'js' && language !== 'ts') {
      return this.failure(
        node.id,
        `Unsupported language: ${language}. Only JavaScript/TypeScript is supported.`,
        Date.now() - startTime,
        context.retryCount
      );
    }

    try {
      // Validate code first
      const validation = this.sandbox.validateCode(code);
      if (!validation.valid) {
        return this.failure(
          node.id,
          `Code validation failed: ${validation.issues.join('; ')}`,
          Date.now() - startTime,
          context.retryCount
        );
      }

      // Execute in sandbox
      const result = await this.sandbox.execute(code, context.inputs);

      return this.success(
        node.id,
        {
          result: result.output,
          logs: result.logs,
          duration: result.duration
        },
        Date.now() - startTime,
        context.retryCount,
        { language }
      );

    } catch (error) {
      return this.failure(
        node.id,
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime,
        context.retryCount,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    const code = node.config.codeScript;
    if (!code || typeof code !== 'string') {
      return false;
    }

    const validation = this.sandbox.validateCode(code);
    return validation.valid;
  }

  getSchema(): NodePort[] {
    return [
      { name: 'codeScript', type: 'string', required: true, description: 'Code to execute' },
      { name: 'codeLanguage', type: 'string', required: false, description: 'Programming language (javascript/typescript)' },
      { name: 'result', type: 'any', required: false, description: 'Code execution result' },
      { name: 'logs', type: 'array', required: false, description: 'Console output logs' }
    ];
  }
}

export default CodeNodeExecutor;
