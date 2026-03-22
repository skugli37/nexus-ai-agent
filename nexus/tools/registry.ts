/**
 * NEXUS Tools Registry
 * Central registry for all executable tools
 * 
 * This module provides:
 * - Tool registration and discovery
 * - Tool execution with validation
 * - Built-in tool implementations
 */

import ZAI from 'z-ai-web-dev-sdk';

// ============================================================================
// Types
// ============================================================================

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  required?: string[];
  handler: (params: Record<string, unknown>) => Promise<unknown>;
  validate?: (params: Record<string, unknown>) => boolean | string;
  timeout?: number;
  retries?: number;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  tokensUsed?: number;
}

// ============================================================================
// Tools Registry
// ============================================================================

class ToolsRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private executionHistory: Array<{
    tool: string;
    timestamp: Date;
    success: boolean;
    duration: number;
  }> = [];

  constructor() {
    this.registerBuiltInTools();
  }

  /**
   * Register a new tool
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all tools
   */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool
   */
  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
        duration: 0
      };
    }

    const startTime = Date.now();

    try {
      // Validate parameters
      if (tool.validate) {
        const validation = tool.validate(params);
        if (validation !== true) {
          return {
            success: false,
            error: typeof validation === 'string' ? validation : 'Validation failed',
            duration: Date.now() - startTime
          };
        }
      }

      // Check required parameters
      if (tool.required) {
        for (const req of tool.required) {
          if (!(req in params) || params[req] === undefined) {
            return {
              success: false,
              error: `Missing required parameter: ${req}`,
              duration: Date.now() - startTime
            };
          }
        }
      }

      // Execute with timeout
      const timeout = tool.timeout || 30000;
      const result = await this.executeWithTimeout(tool.handler, params, timeout);

      const duration = Date.now() - startTime;

      // Record execution
      this.executionHistory.push({
        tool: name,
        timestamp: new Date(),
        success: true,
        duration
      });

      return {
        success: true,
        data: result,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure
      this.executionHistory.push({
        tool: name,
        timestamp: new Date(),
        success: false,
        duration
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(
    handler: (params: Record<string, unknown>) => Promise<unknown>,
    params: Record<string, unknown>,
    timeout: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);

      handler(params)
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
   * Get execution statistics
   */
  getStats(): {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    byTool: Record<string, { count: number; successRate: number; avgDuration: number }>;
  } {
    const byTool: Record<string, { count: number; successRate: number; avgDuration: number }> = {};

    for (const exec of this.executionHistory) {
      if (!byTool[exec.tool]) {
        byTool[exec.tool] = { count: 0, successRate: 0, avgDuration: 0 };
      }
      byTool[exec.tool].count++;
    }

    for (const exec of this.executionHistory) {
      const stats = byTool[exec.tool];
      stats.successRate = (stats.successRate * (stats.count - 1) + (exec.success ? 1 : 0)) / stats.count;
      stats.avgDuration = (stats.avgDuration * (stats.count - 1) + exec.duration) / stats.count;
    }

    const totalSuccess = this.executionHistory.filter(e => e.success).length;
    const totalDuration = this.executionHistory.reduce((sum, e) => sum + e.duration, 0);

    return {
      totalExecutions: this.executionHistory.length,
      successRate: this.executionHistory.length > 0 ? totalSuccess / this.executionHistory.length : 0,
      avgDuration: this.executionHistory.length > 0 ? totalDuration / this.executionHistory.length : 0,
      byTool
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Register built-in tools
   */
  private registerBuiltInTools(): void {
    // Web Search Tool
    this.register({
      name: 'web_search',
      description: 'Search the web for information using z-ai-web-dev-sdk',
      parameters: [
        { type: 'string', description: 'Search query', required: true },
        { type: 'number', description: 'Number of results', required: false }
      ],
      required: ['query'],
      handler: async (params) => {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();
        
        const result = await zai.functions.invoke('web_search', {
          query: String(params.query || ''),
          num: Number(params.num) || 10
        });

        return result;
      }
    });

    // HTTP Request Tool
    this.register({
      name: 'http_request',
      description: 'Make HTTP requests to external APIs and services',
      parameters: [
        { type: 'string', description: 'URL to request', required: true },
        { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)', required: false, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
        { type: 'object', description: 'Request headers', required: false },
        { type: 'object', description: 'Request body', required: false }
      ],
      required: ['url'],
      handler: async (params) => {
        const response = await fetch(params.url as string, {
          method: (params.method as string) || 'GET',
          headers: params.headers as Record<string, string>,
          body: params.body ? JSON.stringify(params.body) : undefined
        });

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') 
          ? await response.json() 
          : await response.text();

        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers),
          data
        };
      }
    });

    // JSON Transform Tool
    this.register({
      name: 'json_transform',
      description: 'Transform JSON data using template substitution',
      parameters: [
        { type: 'object', description: 'Input JSON data', required: true },
        { type: 'string', description: 'Template with {{path}} placeholders', required: true }
      ],
      required: ['data', 'template'],
      handler: async (params) => {
        const data = params.data;
        const template = params.template as string;
        
        let result = template;
        const matches = template.matchAll(/\{\{([^}]+)\}\}/g);
        
        for (const match of matches) {
          const path = match[1].trim();
          const value = path.split('.').reduce((obj: any, key) => obj?.[key], data);
          result = result.replace(match[0], String(value ?? ''));
        }

        return { transformed: result };
      }
    });

    // Text Analysis Tool
    this.register({
      name: 'text_analyze',
      description: 'Analyze text for patterns, sentiment, and statistics',
      parameters: [
        { type: 'string', description: 'Text to analyze', required: true },
        { type: 'boolean', description: 'Include detailed analysis', required: false }
      ],
      required: ['text'],
      handler: async (params) => {
        const text = params.text as string;
        const detailed = params.detailed as boolean;
        
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        // Word frequency
        const wordFreq: Record<string, number> = {};
        for (const word of words) {
          if (word.length > 3) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
          }
        }

        const topKeywords = Object.entries(wordFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([word, count]) => ({ word, count }));

        const result: Record<string, unknown> = {
          wordCount: words.length,
          charCount: text.length,
          sentenceCount: sentences.length,
          avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / Math.max(1, words.length),
          avgSentenceLength: words.length / Math.max(1, sentences.length),
          topKeywords,
          uniqueWords: Object.keys(wordFreq).length,
          vocabularyRichness: Object.keys(wordFreq).length / Math.max(1, words.length)
        };

        if (detailed) {
          result.readabilityScore = 206.835 - 1.015 * (result.avgSentenceLength as number) - 84.6 * (result.avgWordLength as number);
          result.questions = (text.match(/\?/g) || []).length;
          result.exclamations = (text.match(/!/g) || []).length;
          result.numbers = (text.match(/\d+/g) || []).length;
          result.urls = (text.match(/https?:\/\/[^\s]+/g) || []).length;
          result.emails = (text.match(/[\w.-]+@[\w.-]+\.\w+/g) || []).length;
        }

        return result;
      }
    });

    // Code Format Tool
    this.register({
      name: 'code_format',
      description: 'Format code in various programming languages',
      parameters: [
        { type: 'string', description: 'Code to format', required: true },
        { type: 'string', description: 'Programming language', required: true, enum: ['json', 'typescript', 'javascript', 'html', 'css', 'sql'] },
        { type: 'number', description: 'Indentation size', required: false }
      ],
      required: ['code', 'language'],
      handler: async (params) => {
        const code = params.code as string;
        const language = params.language as string;
        const indent = (params.indentSize as number) || 2;

        let formatted = code;

        switch (language) {
          case 'json':
            formatted = JSON.stringify(JSON.parse(code), null, indent);
            break;
          case 'typescript':
          case 'javascript':
            // Basic formatting - add proper indentation
            formatted = code
              .replace(/\s*{\s*/g, ' {\n')
              .replace(/\s*}\s*/g, '\n}\n')
              .replace(/;\s*/g, ';\n')
              .replace(/,\s*/g, ',\n');
            break;
          case 'sql':
            formatted = code
              .replace(/\bSELECT\b/gi, 'SELECT\n  ')
              .replace(/\bFROM\b/gi, '\nFROM\n  ')
              .replace(/\bWHERE\b/gi, '\nWHERE ')
              .replace(/\bJOIN\b/gi, '\nJOIN ')
              .replace(/\bGROUP BY\b/gi, '\nGROUP BY ')
              .replace(/\bORDER BY\b/gi, '\nORDER BY ');
            break;
          case 'html':
            formatted = code
              .replace(/></g, '>\n<')
              .replace(/^\s+/gm, '');
            break;
        }

        return { formatted, language, indentSize: indent };
      }
    });

    // Memory Store Tool
    this.register({
      name: 'memory_store',
      description: 'Store information in NEXUS memory system',
      parameters: [
        { type: 'string', description: 'Content to store', required: true },
        { type: 'string', description: 'Memory type', required: false, enum: ['episodic', 'semantic', 'procedural', 'working'] },
        { type: 'number', description: 'Importance score (0-1)', required: false }
      ],
      required: ['content'],
      handler: async (params) => {
        // This would integrate with the actual memory system
        return {
          stored: true,
          content: params.content,
          type: params.type || 'episodic',
          importance: params.importance || 0.5,
          storedAt: new Date().toISOString()
        };
      }
    });

    // Date/Time Tool
    this.register({
      name: 'datetime',
      description: 'Get current date/time or parse/format dates',
      parameters: [
        { type: 'string', description: 'Operation: now, parse, format', required: true, enum: ['now', 'parse', 'format'] },
        { type: 'string', description: 'Date string to parse or format', required: false },
        { type: 'string', description: 'Output format', required: false }
      ],
      required: ['operation'],
      handler: async (params) => {
        const operation = params.operation as string;
        const now = new Date();

        switch (operation) {
          case 'now':
            return {
              iso: now.toISOString(),
              unix: Math.floor(now.getTime() / 1000),
              utc: now.toUTCString(),
              local: now.toLocaleString(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

          case 'parse':
            if (!params.dateString) {
              throw new Error('dateString required for parse operation');
            }
            const parsed = new Date(params.dateString as string);
            return {
              iso: parsed.toISOString(),
              unix: Math.floor(parsed.getTime() / 1000),
              valid: !isNaN(parsed.getTime())
            };

          case 'format':
            const targetDate = params.dateString ? new Date(params.dateString as string) : now;
            const format = (params.format as string) || 'iso';
            
            switch (format) {
              case 'iso':
                return { formatted: targetDate.toISOString() };
              case 'date':
                return { formatted: targetDate.toISOString().split('T')[0] };
              case 'time':
                return { formatted: targetDate.toISOString().split('T')[1].split('.')[0] };
              default:
                return { formatted: targetDate.toISOString() };
            }

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      }
    });

    // UUID Generator Tool
    this.register({
      name: 'uuid_generate',
      description: 'Generate UUIDs and unique identifiers',
      parameters: [
        { type: 'string', description: 'UUID version', required: false, enum: ['v4', 'v5', 'nanoid'] },
        { type: 'number', description: 'Number of UUIDs to generate', required: false }
      ],
      handler: async (params) => {
        const version = params.version || 'v4';
        const count = (params.count as number) || 1;

        const generateV4 = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };

        const generateNanoId = (length: number = 21) => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        const uuids: string[] = [];
        for (let i = 0; i < count; i++) {
          if (version === 'v4') {
            uuids.push(generateV4());
          } else if (version === 'nanoid') {
            uuids.push(generateNanoId());
          } else {
            uuids.push(generateV4());
          }
        }

        return { uuids, version, count };
      }
    });

    // Hash Tool
    this.register({
      name: 'hash',
      description: 'Generate hash values for data',
      parameters: [
        { type: 'string', description: 'Data to hash', required: true },
        { type: 'string', description: 'Hash algorithm', required: false, enum: ['md5', 'sha256', 'sha512', 'simple'] }
      ],
      required: ['data'],
      handler: async (params) => {
        const data = params.data as string;
        const algorithm = params.algorithm || 'simple';

        // Simple hash implementation (for demonstration)
        const simpleHash = (str: string): string => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return Math.abs(hash).toString(16).padStart(8, '0');
        };

        // Use Web Crypto API for SHA hashes
        const shaHash = async (str: string, algo: string): Promise<string> => {
          const encoder = new TextEncoder();
          const data = encoder.encode(str);
          const hashBuffer = await crypto.subtle.digest(algo, data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        };

        let hash: string;
        switch (algorithm) {
          case 'sha256':
            hash = await shaHash(data, 'SHA-256');
            break;
          case 'sha512':
            hash = await shaHash(data, 'SHA-512');
            break;
          case 'simple':
          case 'md5':
          default:
            hash = simpleHash(data);
        }

        return {
          hash,
          algorithm,
          inputLength: data.length
        };
      }
    });
  }
}

// Export singleton instance
export const toolsRegistry = new ToolsRegistry();
export default toolsRegistry;
