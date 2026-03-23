/**
 * NEXUS HTTP Node Executor
 * 
 * Makes HTTP requests with configurable method, headers, and body
 */

import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';

export class HTTPNodeExecutor extends NodeExecutor<'http'> {
  readonly type = 'http' as const;

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const url = this.resolveTemplate(node.config.httpUrl, context);
    const method = node.config.httpMethod || 'GET';
    const headers = node.config.httpHeaders || {};
    const body = node.config.httpBody;
    const timeout = node.config.httpTimeout || 30000;

    if (!url) {
      return this.failure(
        node.id,
        'HTTP URL not specified',
        Date.now() - startTime,
        context.retryCount
      );
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.resolveHeaders(headers, context)
        },
        body: body ? JSON.stringify(this.resolveTemplateObject(body, context)) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data: unknown;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return this.success(
        node.id,
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data,
          ok: response.ok
        },
        Date.now() - startTime,
        context.retryCount,
        { method, url }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('abort')) {
        return this.failure(
          node.id,
          `HTTP request timed out after ${timeout}ms`,
          Date.now() - startTime,
          context.retryCount
        );
      }

      return this.failure(
        node.id,
        `HTTP request failed: ${errorMessage}`,
        Date.now() - startTime,
        context.retryCount
      );
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    if (!node.config.httpUrl || typeof node.config.httpUrl !== 'string') {
      return false;
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    const method = node.config.httpMethod || 'GET';
    
    return validMethods.includes(method.toUpperCase());
  }

  getSchema(): NodePort[] {
    return [
      { name: 'httpUrl', type: 'string', required: true, description: 'Request URL' },
      { name: 'httpMethod', type: 'string', required: false, description: 'HTTP method (GET/POST/PUT/DELETE/PATCH)' },
      { name: 'httpHeaders', type: 'object', required: false, description: 'Request headers' },
      { name: 'httpBody', type: 'object', required: false, description: 'Request body' },
      { name: 'data', type: 'any', required: false, description: 'Response data' },
      { name: 'status', type: 'number', required: false, description: 'HTTP status code' }
    ];
  }

  /**
   * Resolve template variables in string
   */
  private resolveTemplate(template: string, context: ExecutionContext): string {
    if (!template || typeof template !== 'string') return template;

    const variables = { ...context.variables, ...context.inputs };
    
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      const value = variables[name];
      if (value === undefined) return `{{${name}}}`;
      return String(value);
    });
  }

  /**
   * Resolve template variables in object
   */
  private resolveTemplateObject(obj: unknown, context: ExecutionContext): unknown {
    if (typeof obj === 'string') {
      return this.resolveTemplate(obj, context);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveTemplateObject(item, context));
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveTemplateObject(value, context);
      }
      return result;
    }
    return obj;
  }

  /**
   * Resolve headers with template variables
   */
  private resolveHeaders(
    headers: Record<string, string>,
    context: ExecutionContext
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      resolved[key] = this.resolveTemplate(value, context);
    }
    return resolved;
  }
}

export default HTTPNodeExecutor;
