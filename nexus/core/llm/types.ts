/**
 * NEXUS LLM Provider Types
 * 
 * Supports multiple LLM providers:
 * - z-ai (default)
 * - OpenAI
 * - Anthropic Claude
 * - Local models (Ollama)
 * - Custom endpoints
 */

// ============================================================================
// Types
// ============================================================================

export type LLMProviderType = 'z-ai' | 'openai' | 'anthropic' | 'ollama' | 'custom';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model?: string;
  provider: LLMProviderType;
  latency: number;
}

export interface LLMConfig {
  provider: LLMProviderType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMProvider {
  name: LLMProviderType;
  isAvailable(): Promise<boolean>;
  chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse>;
  getModels(): string[];
}

// ============================================================================
// Provider Configurations
// ============================================================================

export const PROVIDER_CONFIGS: Record<LLMProviderType, {
  name: string;
  defaultModel: string;
  baseUrl?: string;
  envKey?: string;
}> = {
  'z-ai': {
    name: 'Z-AI (Default)',
    defaultModel: 'default',
  },
  'openai': {
    name: 'OpenAI',
    defaultModel: 'gpt-4-turbo-preview',
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
  },
  'anthropic': {
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-opus-20240229',
    baseUrl: 'https://api.anthropic.com/v1',
    envKey: 'ANTHROPIC_API_KEY',
  },
  'ollama': {
    name: 'Ollama (Local)',
    defaultModel: 'llama2',
    baseUrl: 'http://localhost:11434',
  },
  'custom': {
    name: 'Custom Endpoint',
    defaultModel: 'default',
  },
};

// ============================================================================
// Model Lists
// ============================================================================

export const MODELS: Record<LLMProviderType, string[]> = {
  'z-ai': ['default'],
  'openai': [
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ],
  'anthropic': [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
    'claude-2.0',
    'claude-instant-1.2',
  ],
  'ollama': [
    'llama2',
    'llama3',
    'mistral',
    'mixtral',
    'codellama',
    'deepseek-coder',
    'phi',
    'gemma',
  ],
  'custom': ['custom'],
};
