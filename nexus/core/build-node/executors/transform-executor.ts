/**
 * NEXUS Transform Node Executor
 * 
 * Transforms data between formats (JSON, YAML, CSV, etc.)
 * Also supports custom transformations with mapping expressions
 */

import { NodeExecutor } from '../executor';
import { BuildNode, ExecutionContext, NodeExecutionResult, NodePort } from '../types';

export class TransformNodeExecutor extends NodeExecutor<'transform'> {
  readonly type = 'transform' as const;

  async execute(node: BuildNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const transformType = node.config.transformType || 'json';
    const input = context.inputs.data || context.inputs;

    try {
      let result: unknown;

      switch (transformType) {
        case 'json':
          result = await this.toJSON(input);
          break;
        case 'yaml':
          result = await this.toYAML(input);
          break;
        case 'csv':
          result = await this.toCSV(input, node.config.mapping);
          break;
        case 'xml':
          result = await this.toXML(input);
          break;
        case 'custom':
          result = await this.customTransform(input, node.config.transformExpression, node.config.mapping, context);
          break;
        default:
          return this.failure(
            node.id,
            `Unknown transform type: ${transformType}`,
            Date.now() - startTime,
            context.retryCount
          );
      }

      return this.success(
        node.id,
        { result, originalType: typeof input, transformedType: transformType },
        Date.now() - startTime,
        context.retryCount
      );

    } catch (error) {
      return this.failure(
        node.id,
        `Transform failed: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - startTime,
        context.retryCount
      );
    }
  }

  async validate(node: BuildNode): Promise<boolean> {
    const validTypes = ['json', 'yaml', 'csv', 'xml', 'custom'];
    const transformType = node.config.transformType || 'json';
    return validTypes.includes(transformType);
  }

  getSchema(): NodePort[] {
    return [
      { name: 'data', type: 'any', required: true, description: 'Input data to transform' },
      { name: 'transformType', type: 'string', required: false, description: 'Target format' },
      { name: 'mapping', type: 'object', required: false, description: 'Field mapping' },
      { name: 'result', type: 'any', required: false, description: 'Transformed data' }
    ];
  }

  /**
   * Convert to JSON string
   */
  private async toJSON(input: unknown): Promise<string> {
    if (typeof input === 'string') {
      // Try to parse and re-format
      try {
        const parsed = JSON.parse(input);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // Not valid JSON, return as string
        return JSON.stringify(input);
      }
    }
    return JSON.stringify(input, null, 2);
  }

  /**
   * Convert to YAML format
   */
  private async toYAML(input: unknown): Promise<string> {
    const obj = typeof input === 'string' ? JSON.parse(input) : input;
    return this.objectToYAML(obj);
  }

  /**
   * Simple object to YAML converter
   */
  private objectToYAML(obj: unknown, indent: number = 0): string {
    if (obj === null || obj === undefined) {
      return 'null';
    }

    if (typeof obj !== 'object') {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => {
        const content = this.objectToYAML(item, indent + 2);
        return `${' '.repeat(indent)}- ${content.startsWith('\n') ? content : content}`;
      }).join('\n');
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === 'object' && value !== null) {
        lines.push(`${' '.repeat(indent)}${key}:`);
        lines.push(this.objectToYAML(value, indent + 2));
      } else {
        lines.push(`${' '.repeat(indent)}${key}: ${this.formatYAMLValue(value)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format value for YAML
   */
  private formatYAMLValue(value: unknown): string {
    if (typeof value === 'string') {
      if (value.includes('\n') || value.includes(':') || value.includes('#')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    if (value === null) return 'null';
    if (value === undefined) return 'null';
    return String(value);
  }

  /**
   * Convert to CSV format
   */
  private async toCSV(input: unknown, mapping?: Record<string, string>): Promise<string> {
    const arr = Array.isArray(input) ? input : [input];
    
    if (arr.length === 0) return '';

    // Get headers
    const headers = mapping 
      ? Object.keys(mapping)
      : Object.keys(arr[0] as Record<string, unknown>);

    const rows: string[][] = [headers];

    for (const item of arr) {
      const row = headers.map(h => {
        const sourceKey = mapping?.[h] || h;
        const value = (item as Record<string, unknown>)[sourceKey];
        return this.formatCSVValue(value);
      });
      rows.push(row);
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Format value for CSV
   */
  private formatCSVValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Convert to XML format
   */
  private async toXML(input: unknown, rootName: string = 'root'): Promise<string> {
    const obj = typeof input === 'string' ? JSON.parse(input) : input;
    return this.objectToXML(obj, rootName);
  }

  /**
   * Simple object to XML converter
   */
  private objectToXML(obj: unknown, name: string): string {
    if (obj === null || obj === undefined) {
      return `<${name}/>`;
    }

    if (typeof obj !== 'object') {
      return `<${name}>${this.escapeXML(String(obj))}</${name}>`;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.objectToXML(item, name)).join('\n');
    }

    const content = Object.entries(obj as Record<string, unknown>)
      .map(([k, v]) => this.objectToXML(v, k))
      .join('\n');

    return `<${name}>\n${content}\n</${name}>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Custom transformation with expression
   */
  private async customTransform(
    input: unknown,
    expression: string | undefined,
    mapping: Record<string, string> | undefined,
    context: ExecutionContext
  ): Promise<unknown> {
    if (!expression && !mapping) {
      return input;
    }

    // Apply mapping first
    let result = input;
    if (mapping && typeof input === 'object' && input !== null) {
      const mapped: Record<string, unknown> = {};
      for (const [targetKey, sourceKey] of Object.entries(mapping)) {
        mapped[targetKey] = (input as Record<string, unknown>)[sourceKey];
      }
      result = mapped;
    }

    // Apply expression if provided
    if (expression) {
      try {
        const fn = new Function('input', 'context', `return ${expression}`);
        result = fn(result, context);
      } catch (error) {
        console.warn('Transform expression failed:', error);
        // Return mapped result if expression fails
      }
    }

    return result;
  }
}

export default TransformNodeExecutor;
