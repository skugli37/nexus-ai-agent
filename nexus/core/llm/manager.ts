/**
 * NEXUS LLM Manager
 * 
 * Central manager for all LLM providers with:
 * - Multiple provider support
 * - Automatic fallback
 * - Load balancing
 * - Cost tracking
 */

import {
  LLMProviderType,
  LLMMessage,
  LLMResponse,
  LLMConfig,
  LLMProvider,
  PROVIDER_CONFIGS,
} from './types';
import { createProvider, ZAIProvider, OpenAIProvider, AnthropicProvider, OllamaProvider, CustomProvider } from './providers';

// ============================================================================
// Types
// ============================================================================

export interface LLMManagerConfig {
  defaultProvider: LLMProviderType;
  fallbackProviders: LLMProviderType[];
  enableFallback: boolean;
  trackUsage: boolean;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  byProvider: Record<LLMProviderType, {
    requests: number;
    tokens: number;
    avgLatency: number;
    errors: number;
  }>;
}

// ============================================================================
// LLM Manager
// ============================================================================

export class LLMManager {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private config: LLMManagerConfig;
  private usageStats: UsageStats;
  private availableProviders: Set<LLMProviderType> = new Set();

  constructor(config?: Partial<LLMManagerConfig>) {
    this.config = {
      defaultProvider: config?.defaultProvider || 'z-ai',
      fallbackProviders: config?.fallbackProviders || ['z-ai'],
      enableFallback: config?.enableFallback ?? true,
      trackUsage: config?.trackUsage ?? true,
    };

    this.usageStats = {
      totalRequests: 0,
      totalTokens: 0,
      byProvider: {} as any,
    };

    // Initialize all providers
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  private async initializeProviders(): Promise<void> {
    const providerTypes: LLMProviderType[] = ['z-ai', 'openai', 'anthropic', 'ollama', 'custom'];
    
    for (const type of providerTypes) {
      try {
        const provider = createProvider(type);
        const available = await provider.isAvailable();
        
        this.providers.set(type, provider);
        this.usageStats.byProvider[type] = {
          requests: 0,
          tokens: 0,
          avgLatency: 0,
          errors: 0,
        };

        if (available) {
          this.availableProviders.add(type);
          console.log(`✅ LLM Provider '${type}' is available`);
        } else {
          console.log(`⚠️ LLM Provider '${type}' is not configured`);
        }
      } catch (error) {
        console.warn(`Failed to initialize provider '${type}':`, error);
      }
    }
  }

  /**
   * Check which providers are available
   */
  async checkAvailability(): Promise<Record<LLMProviderType, boolean>> {
    const status: Record<LLMProviderType, boolean> = {} as any;
    
    for (const [type, provider] of this.providers) {
      try {
        status[type] = await provider.isAvailable();
      } catch {
        status[type] = false;
      }
    }

    return status;
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): LLMProviderType {
    return this.config.defaultProvider;
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(type: LLMProviderType): void {
    if (this.providers.has(type)) {
      this.config.defaultProvider = type;
      console.log(`Default LLM provider set to: ${type}`);
    } else {
      throw new Error(`Provider '${type}' not found`);
    }
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): LLMProviderType[] {
    return Array.from(this.availableProviders);
  }

  /**
   * Chat with automatic provider selection and fallback
   */
  async chat(
    messages: LLMMessage[],
    options?: Partial<LLMConfig> & { provider?: LLMProviderType }
  ): Promise<LLMResponse> {
    const requestedProvider = options?.provider || this.config.defaultProvider;
    const providers = this.config.enableFallback
      ? [requestedProvider, ...this.config.fallbackProviders.filter(p => p !== requestedProvider)]
      : [requestedProvider];

    let lastError: Error | null = null;

    for (const providerType of providers) {
      if (!this.availableProviders.has(providerType)) {
        continue;
      }

      const provider = this.providers.get(providerType);
      if (!provider) continue;

      try {
        const response = await this.executeWithTracking(provider, messages, options);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Provider '${providerType}' failed:`, lastError.message);
        
        // Track error
        this.usageStats.byProvider[providerType].errors++;
        
        // Try next provider
        continue;
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Execute with usage tracking
   */
  private async executeWithTracking(
    provider: LLMProvider,
    messages: LLMMessage[],
    options?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    const response = await provider.chat(messages, options);
    
    const duration = Date.now() - startTime;

    if (this.config.trackUsage) {
      this.usageStats.totalRequests++;
      this.usageStats.totalTokens += response.tokens.total;
      
      const providerStats = this.usageStats.byProvider[response.provider];
      providerStats.requests++;
      providerStats.tokens += response.tokens.total;
      providerStats.avgLatency = 
        (providerStats.avgLatency * (providerStats.requests - 1) + duration) / providerStats.requests;
    }

    return response;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): UsageStats {
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics
   */
  resetStats(): void {
    this.usageStats = {
      totalRequests: 0,
      totalTokens: 0,
      byProvider: {} as any,
    };

    for (const type of this.providers.keys()) {
      this.usageStats.byProvider[type] = {
        requests: 0,
        tokens: 0,
        avgLatency: 0,
        errors: 0,
      };
    }
  }

  /**
   * Get provider information
   */
  getProviderInfo(type: LLMProviderType): {
    config: typeof PROVIDER_CONFIGS[LLMProviderType];
    models: string[];
    available: boolean;
  } {
    const provider = this.providers.get(type);
    return {
      config: PROVIDER_CONFIGS[type],
      models: provider?.getModels() || [],
      available: this.availableProviders.has(type),
    };
  }

  /**
   * Get all providers info
   */
  getAllProvidersInfo(): Record<LLMProviderType, ReturnType<LLMManager['getProviderInfo']>> {
    const info: any = {};
    for (const type of this.providers.keys()) {
      info[type] = this.getProviderInfo(type);
    }
    return info;
  }

}

// ============================================================================
// Singleton Instance
// ============================================================================

let llmManagerInstance: LLMManager | null = null;

export async function getLLMManager(config?: Partial<LLMManagerConfig>): Promise<LLMManager> {
  if (!llmManagerInstance) {
    llmManagerInstance = new LLMManager(config);
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return llmManagerInstance;
}

export { createProvider };
