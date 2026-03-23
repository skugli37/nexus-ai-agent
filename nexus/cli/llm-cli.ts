/**
 * NEXUS CLI - LLM Provider Management
 * 
 * Commands for managing LLM providers from CLI
 */

import ZAI from 'z-ai-web-dev-sdk';
import readline from 'readline';
import { LLMProviderType, PROVIDER_CONFIGS, MODELS } from '../core/llm/types';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

interface LLMConfig {
  defaultProvider: LLMProviderType;
  apiKeys: Record<LLMProviderType, string>;
  baseUrls: Record<LLMProviderType, string>;
}

// ============================================================================
// LLM CLI
// ============================================================================

export class LLMCLI {
  private configPath: string;
  private config: LLMConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private rl: readline.Interface | null = null;

  constructor() {
    const nexusHome = join(process.env.HOME || '/root', '.nexus');
    this.configPath = join(nexusHome, 'llm-config.json');
    
    // Default config
    this.config = {
      defaultProvider: 'z-ai',
      apiKeys: {
        'z-ai': '',
        'openai': process.env.OPENAI_API_KEY || '',
        'anthropic': process.env.ANTHROPIC_API_KEY || '',
        'ollama': '',
        'custom': '',
      },
      baseUrls: {
        'z-ai': '',
        'openai': 'https://api.openai.com/v1',
        'anthropic': 'https://api.anthropic.com/v1',
        'ollama': 'http://localhost:11434',
        'custom': process.env.CUSTOM_LLM_URL || '',
      },
    };

    this.loadConfig();
  }

  /**
   * Start the LLM management CLI
   */
  async start(): Promise<void> {
    this.zai = await ZAI.create();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.showMenu();

    while (true) {
      const input = await this.question('\n> ');
      const result = await this.handleCommand(input);
      if (result === 'exit') break;
    }

    this.rl.close();
  }

  /**
   * Show main menu
   */
  private showMenu(): void {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🧠 NEXUS LLM Provider Manager                 ║
╠══════════════════════════════════════════════════════════════╣
║  Current Default: ${this.config.defaultProvider.padEnd(42)}║
╠══════════════════════════════════════════════════════════════╣
║  Commands:                                                    ║
║    list        - List all available providers                 ║
║    status      - Show current provider status                 ║
║    switch <n>  - Switch to provider (z-ai, openai, etc.)      ║
║    config <n>  - Configure provider (API key, URL)            ║
║    test <n>    - Test a provider with sample prompt           ║
║    models <n>  - List available models for provider           ║
║    keys        - Manage API keys                              ║
║    save        - Save current configuration                   ║
║    help        - Show this menu                               ║
║    exit        - Exit LLM manager                             ║
╚══════════════════════════════════════════════════════════════╝
`);
  }

  /**
   * Handle CLI commands
   */
  private async handleCommand(input: string): Promise<string | void> {
    const [cmd, ...args] = input.trim().toLowerCase().split(/\s+/);

    switch (cmd) {
      case 'list':
      case 'ls':
        this.listProviders();
        break;

      case 'status':
      case 'st':
        this.showStatus();
        break;

      case 'switch':
      case 'use':
        await this.switchProvider(args[0]);
        break;

      case 'config':
      case 'cfg':
        await this.configureProvider(args[0]);
        break;

      case 'test':
        await this.testProvider(args[0]);
        break;

      case 'models':
      case 'mods':
        this.showModels(args[0]);
        break;

      case 'keys':
      case 'key':
        await this.manageKeys();
        break;

      case 'save':
        this.saveConfig();
        console.log('✅ Configuration saved!');
        break;

      case 'help':
      case 'h':
      case '?':
        this.showMenu();
        break;

      case 'exit':
      case 'quit':
      case 'q':
        return 'exit';

      default:
        console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
    }
  }

  /**
   * List all providers
   */
  private listProviders(): void {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Available LLM Providers                    ║
╠══════════════════════════════════════════════════════════════╣
`);

    const providers: LLMProviderType[] = ['z-ai', 'openai', 'anthropic', 'ollama', 'custom'];

    for (const provider of providers) {
      const config = PROVIDER_CONFIGS[provider];
      const isDefault = provider === this.config.defaultProvider;
      const hasKey = this.hasApiKey(provider);
      const status = hasKey ? '✅ Ready' : '⚠️  Needs config';

      console.log(`║  ${isDefault ? '→' : ' '} ${provider.padEnd(12)} ${config.name.padEnd(20)} ${status.padEnd(15)}║`);
    }

    console.log(`╚══════════════════════════════════════════════════════════════╝`);
  }

  /**
   * Show current status
   */
  private showStatus(): void {
    const provider = this.config.defaultProvider;
    const config = PROVIDER_CONFIGS[provider];
    const hasKey = this.hasApiKey(provider);

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     Current LLM Status                        ║
╠══════════════════════════════════════════════════════════════╣
║  Provider:     ${provider.padEnd(43)}║
║  Name:         ${config.name.padEnd(43)}║
║  Default Model:${config.defaultModel.padEnd(43)}║
║  API Key:      ${(hasKey ? '✅ Configured' : '❌ Not set').padEnd(43)}║
║  Base URL:     ${(this.config.baseUrls[provider] || 'default').padEnd(43)}║
╚══════════════════════════════════════════════════════════════╝
`);
  }

  /**
   * Switch default provider
   */
  private async switchProvider(provider?: string): Promise<void> {
    if (!provider) {
      console.log('\nUsage: switch <provider>');
      console.log('Providers: z-ai, openai, anthropic, ollama, custom\n');
      return;
    }

    const validProviders: LLMProviderType[] = ['z-ai', 'openai', 'anthropic', 'ollama', 'custom'];
    
    if (!validProviders.includes(provider as LLMProviderType)) {
      console.log(`\n❌ Invalid provider: ${provider}`);
      console.log(`Valid providers: ${validProviders.join(', ')}\n`);
      return;
    }

    const newProvider = provider as LLMProviderType;
    const hasKey = this.hasApiKey(newProvider);

    if (!hasKey && newProvider !== 'z-ai' && newProvider !== 'ollama') {
      console.log(`\n⚠️  Warning: ${newProvider} is not configured.`);
      const configure = await this.question('Configure now? (y/n): ');
      if (configure.toLowerCase() === 'y') {
        await this.configureProvider(newProvider);
      }
    }

    this.config.defaultProvider = newProvider;
    this.saveConfig();
    console.log(`\n✅ Switched to ${PROVIDER_CONFIGS[newProvider].name}\n`);
  }

  /**
   * Configure a provider
   */
  private async configureProvider(provider?: string): Promise<void> {
    if (!provider) {
      console.log('\nUsage: config <provider>');
      console.log('Providers: z-ai, openai, anthropic, ollama, custom\n');
      return;
    }

    const config = PROVIDER_CONFIGS[provider as LLMProviderType];
    if (!config) {
      console.log(`\n❌ Unknown provider: ${provider}\n`);
      return;
    }

    console.log(`\n🔧 Configuring ${config.name}...\n`);

    // API Key
    if (provider !== 'z-ai') {
      const currentKey = this.config.apiKeys[provider as LLMProviderType] || '';
      const maskedKey = currentKey ? `${currentKey.slice(0, 8)}...${currentKey.slice(-4)}` : 'not set';
      console.log(`Current API key: ${maskedKey}`);
      
      const newKey = await this.question('Enter new API key (or press Enter to keep): ');
      if (newKey.trim()) {
        this.config.apiKeys[provider as LLMProviderType] = newKey.trim();
        process.env[config.envKey || ''] = newKey.trim();
      }
    }

    // Base URL
    if (provider === 'ollama' || provider === 'custom') {
      const currentUrl = this.config.baseUrls[provider as LLMProviderType] || '';
      console.log(`Current base URL: ${currentUrl || 'default'}`);
      
      const newUrl = await this.question('Enter new base URL (or press Enter to keep): ');
      if (newUrl.trim()) {
        this.config.baseUrls[provider as LLMProviderType] = newUrl.trim();
      }
    }

    this.saveConfig();
    console.log('\n✅ Configuration saved!\n');
  }

  /**
   * Test a provider
   */
  private async testProvider(provider?: string): Promise<void> {
    const testProvider = (provider as LLMProviderType) || this.config.defaultProvider;
    const config = PROVIDER_CONFIGS[testProvider];

    console.log(`\n🧪 Testing ${config.name}...\n`);

    const testPrompt = await this.question('Enter test prompt (or press Enter for default): ');
    const prompt = testPrompt.trim() || 'Hello! Please respond with a brief greeting.';

    try {
      const startTime = Date.now();

      if (testProvider === 'z-ai') {
        const response = await this.zai!.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
        });

        const duration = Date.now() - startTime;
        console.log(`\n📄 Response (${duration}ms):`);
        console.log(`   ${response.choices[0]?.message?.content}\n`);
        console.log(`   Tokens: ${response.usage?.total_tokens || 'N/A'}`);
      } else {
        console.log('\n⚠️  Direct testing for other providers requires proper API configuration.');
        console.log('   Use the HTTP API endpoint: POST /llm/chat\n');
      }

    } catch (error) {
      console.log(`\n❌ Test failed: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  /**
   * Show models for a provider
   */
  private showModels(provider?: string): void {
    const targetProvider = (provider as LLMProviderType) || this.config.defaultProvider;
    const models = MODELS[targetProvider] || [];

    console.log(`\n📋 Available models for ${PROVIDER_CONFIGS[targetProvider].name}:\n`);

    for (const model of models) {
      const isDefault = model === PROVIDER_CONFIGS[targetProvider].defaultModel;
      console.log(`   ${isDefault ? '→' : ' '} ${model}`);
    }

    console.log();
  }

  /**
   * Manage API keys
   */
  private async manageKeys(): Promise<void> {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                      API Keys Management                      ║
╠══════════════════════════════════════════════════════════════╣
`);

    const providers: LLMProviderType[] = ['openai', 'anthropic', 'custom'];

    for (const provider of providers) {
      const key = this.config.apiKeys[provider];
      const masked = key ? `${key.slice(0, 8)}...${key.slice(-4)}` : '❌ Not set';
      console.log(`║  ${provider.padEnd(12)} ${masked.padEnd(43)}║`);
    }

    console.log(`╚══════════════════════════════════════════════════════════════╝`);

    const action = await this.question('\nSet key for provider (or Enter to skip): ');
    if (action.trim()) {
      await this.configureProvider(action.trim());
    }
  }

  /**
   * Check if provider has API key
   */
  private hasApiKey(provider: LLMProviderType): boolean {
    if (provider === 'z-ai') return true;
    if (provider === 'ollama') return true;
    return !!this.config.apiKeys[provider];
  }

  /**
   * Load config from disk
   */
  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const data = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        this.config = { ...this.config, ...data };
      }
    } catch (e) {
      console.warn('Could not load LLM config, using defaults');
    }
  }

  /**
   * Save config to disk
   */
  private saveConfig(): void {
    try {
      const dir = join(this.configPath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (e) {
      console.warn('Could not save LLM config:', e);
    }
  }

  /**
   * Question helper
   */
  private question(prompt: string): Promise<string> {
    return new Promise(resolve => {
      this.rl?.question(prompt, resolve);
    });
  }

  /**
   * Get current config (for use by other modules)
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): LLMProviderType {
    return this.config.defaultProvider;
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

export async function runLLMCLI(): Promise<void> {
  const cli = new LLMCLI();
  await cli.start();
}

export default LLMCLI;
