/**
 * NEXUS LLM Providers
 * 
 * Implementations for multiple LLM providers
 */

import ZAI from 'z-ai-web-dev-sdk';
import {
  LLMProvider,
  LLMProviderType,
  LLMMessage,
  LLMResponse,
  LLMConfig,
  MODELS,
} from './types';

// ============================================================================
// Z-AI Provider (Default)
// ============================================================================

export class ZAIProvider implements LLMProvider {
  name: LLMProviderType = 'z-ai';
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      this.zai = await ZAI.create();
      return true;
    } catch {
      return false;
    }
  }

  async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    if (!this.zai) {
      await this.isAvailable();
    }

    const startTime = Date.now();
    
    const response = await this.zai!.chat.completions.create({
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    const latency = Date.now() - startTime;

    return {
      content: response.choices[0]?.message?.content || '',
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
      provider: 'z-ai',
      latency,
    };
  }

  getModels(): string[] {
    return MODELS['z-ai'];
  }
}

// ============================================================================
// OpenAI Provider
// ============================================================================

export class OpenAIProvider implements LLMProvider {
  name: LLMProviderType = 'openai';
  private apiKey?: string;
  private baseUrl: string;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
    this.baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    const startTime = Date.now();
    const model = options?.model || 'gpt-4-turbo-preview';

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    return {
      content: data.choices[0]?.message?.content || '',
      tokens: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      },
      model,
      provider: 'openai',
      latency,
    };
  }

  getModels(): string[] {
    return MODELS['openai'];
  }
}

// ============================================================================
// Anthropic Provider
// ============================================================================

export class AnthropicProvider implements LLMProvider {
  name: LLMProviderType = 'anthropic';
  private apiKey?: string;
  private baseUrl: string;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY;
    this.baseUrl = config?.baseUrl || 'https://api.anthropic.com/v1';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
    }

    const startTime = Date.now();
    const model = options?.model || 'claude-3-opus-20240229';

    // Separate system message from other messages
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const otherMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMessage,
        messages: otherMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: options?.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    return {
      content: data.content[0]?.text || '',
      tokens: {
        prompt: data.usage?.input_tokens || 0,
        completion: data.usage?.output_tokens || 0,
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      model,
      provider: 'anthropic',
      latency,
    };
  }

  getModels(): string[] {
    return MODELS['anthropic'];
  }
}

// ============================================================================
// Ollama Provider (Local Models)
// ============================================================================

export class OllamaProvider implements LLMProvider {
  name: LLMProviderType = 'ollama';
  private baseUrl: string;

  constructor(config?: { baseUrl?: string }) {
    this.baseUrl = config?.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options?.model || 'llama2';

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    return {
      content: data.message?.content || '',
      tokens: {
        prompt: data.prompt_eval_count || 0,
        completion: data.eval_count || 0,
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      model,
      provider: 'ollama',
      latency,
    };
  }

  getModels(): string[] {
    return MODELS['ollama'];
  }

  async getInstalledModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }
}

// ============================================================================
// Custom Provider (Generic API)
// ============================================================================

export class CustomProvider implements LLMProvider {
  name: LLMProviderType = 'custom';
  private baseUrl: string;
  private apiKey?: string;
  private headers?: Record<string, string>;

  constructor(config?: { baseUrl?: string; apiKey?: string; headers?: Record<string, string> }) {
    this.baseUrl = config?.baseUrl || process.env.CUSTOM_LLM_URL || '';
    this.apiKey = config?.apiKey || process.env.CUSTOM_LLM_API_KEY;
    this.headers = config?.headers;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.baseUrl;
  }

  async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    if (!this.baseUrl) {
      throw new Error('Custom LLM URL not configured. Set CUSTOM_LLM_URL environment variable.');
    }

    const startTime = Date.now();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    };

    if (this.apiKey) {
      requestHeaders['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        model: options?.model || 'default',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Custom LLM API error: ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    // Try to parse OpenAI-compatible response
    return {
      content: data.choices?.[0]?.message?.content || data.content || '',
      tokens: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      },
      model: options?.model,
      provider: 'custom',
      latency,
    };
  }

  getModels(): string[] {
    return ['custom'];
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

export function createProvider(type: LLMProviderType, config?: Partial<LLMConfig>): LLMProvider {
  switch (type) {
    case 'z-ai':
      return new ZAIProvider();
    case 'openai':
      return new OpenAIProvider({ apiKey: config?.apiKey, baseUrl: config?.baseUrl });
    case 'anthropic':
      return new AnthropicProvider({ apiKey: config?.apiKey, baseUrl: config?.baseUrl });
    case 'ollama':
      return new OllamaProvider({ baseUrl: config?.baseUrl });
    case 'custom':
      return new CustomProvider({
        baseUrl: config?.baseUrl,
        apiKey: config?.apiKey,
        headers: config as any,
      });
    default:
      return new ZAIProvider();
  }
}
