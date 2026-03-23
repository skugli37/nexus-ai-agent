/**
 * NEXUS Condition Node Executor
 * 
 * Evaluates conditional expressions and routes execution flow
 * Supports JavaScript-like expressions with context variables
 */

import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';

export class ConditionNodeExecutor extends NodeExecutor<'condition'> {
  readonly type = 'condition' as const;

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const condition = node.config.condition;

    if (!condition) {
      return this.failure(
        node.id,
        'Condition expression not specified',
        Date.now() - startTime,
        context.retryCount
      );
    }

    try {
      const result = this.evaluateCondition(condition, context);
      const nextNodes = result ? node.config.trueBranch : node.config.falseBranch;

      return this.success(
        node.id,
        {
          result,
          branch: result ? 'true' : 'false',
          nextNodes: nextNodes || []
        },
        Date.now() - startTime,
        context.retryCount,
        { expression: condition }
      );

    } catch (error) {
      return this.failure(
        node.id,
        `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - startTime,
        context.retryCount
      );
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    return !!(node.config.condition && typeof node.config.condition === 'string');
  }

  getSchema(): NodePort[] {
    return [
      { name: 'condition', type: 'string', required: true, description: 'Condition expression to evaluate' },
      { name: 'result', type: 'boolean', required: false, description: 'Evaluation result' },
      { name: 'branch', type: 'string', required: false, description: 'Branch taken (true/false)' },
      { name: 'nextNodes', type: 'array', required: false, description: 'Next node IDs to execute' }
    ];
  }

  /**
   * Evaluate condition expression with context variables
   */
  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    const variables = { ...context.variables, ...context.inputs };
    
    // Replace variable references ($varName or {{varName}})
    let expr = condition;
    
    // Handle {{varName}} syntax
    expr = expr.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      const value = variables[name];
      return this.valueToString(value);
    });
    
    // Handle $varName syntax
    expr = expr.replace(/\$(\w+)/g, (_, name) => {
      const value = variables[name];
      return this.valueToString(value);
    });

    // Validate expression safety
    if (!this.isSafeExpression(expr)) {
      throw new Error(`Unsafe expression: ${expr}`);
    }

    // Evaluate in sandboxed context
    try {
      const fn = new Function(
        'variables',
        `with(variables) { return ${expr}; }`
      );
      const result = fn(variables);
      return Boolean(result);
    } catch (error) {
      // Try simpler evaluation for boolean comparisons
      return this.simpleEvaluate(expr, variables);
    }
  }

  /**
   * Simple evaluation for basic comparisons
   */
  private simpleEvaluate(expr: string, variables: Record<string, unknown>): boolean {
    // Handle equality checks
    const eqMatch = expr.match(/^(.+?)\s*(===|==|!==|!=)\s*(.+)$/);
    if (eqMatch) {
      const left = this.extractValue(eqMatch[1].trim(), variables);
      const op = eqMatch[2];
      const right = this.extractValue(eqMatch[3].trim(), variables);

      switch (op) {
        case '===': return left === right;
        case '==': return left == right;
        case '!==': return left !== right;
        case '!=': return left != right;
      }
    }

    // Handle comparison operators
    const compMatch = expr.match(/^(.+?)\s*(>=|<=|>|<)\s*(.+)$/);
    if (compMatch) {
      const left = Number(this.extractValue(compMatch[1].trim(), variables));
      const op = compMatch[2];
      const right = Number(this.extractValue(compMatch[3].trim(), variables));

      switch (op) {
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '<': return left < right;
      }
    }

    // Handle truthiness
    const value = this.extractValue(expr.trim(), variables);
    return Boolean(value);
  }

  /**
   * Extract value from expression or literal
   */
  private extractValue(expr: string, variables: Record<string, unknown>): unknown {
    // String literal
    if ((expr.startsWith("'") && expr.endsWith("'")) || 
        (expr.startsWith('"') && expr.endsWith('"'))) {
      return expr.slice(1, -1);
    }
    
    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return Number(expr);
    }
    
    // Boolean literals
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (expr === 'undefined') return undefined;
    
    // Variable reference
    if (expr in variables) {
      return variables[expr];
    }
    
    return expr;
  }

  /**
   * Convert value to string for expression
   */
  private valueToString(value: unknown): string {
    if (typeof value === 'string') return `"${value}"`;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    return String(value);
  }

  /**
   * Check if expression is safe to evaluate
   */
  private isSafeExpression(expr: string): boolean {
    // Block dangerous patterns
    const dangerous = [
      'eval', 'Function', 'require', 'import', 'process', 'global',
      '__dirname', '__filename', 'fetch', 'XMLHttpRequest', 'WebSocket',
      'document', 'window', 'navigator', 'console'
    ];
    
    for (const pattern of dangerous) {
      if (new RegExp(`\\b${pattern}\\b`).test(expr)) {
        return false;
      }
    }
    
    return true;
  }
}

export default ConditionNodeExecutor;
