/**
 * NEXUS CLI Configuration Module
 * Handles environment variables, paths, and model settings
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ============================================================================
// Types
// ============================================================================

export interface NexusConfig {
  /** NEXUS home directory */
  nexusHome: string;
  /** Skills directory */
  skillsPath: string;
  /** Memory storage path */
  memoryPath: string;
  /** Sessions storage path */
  sessionsPath: string;
  /** Tools directory */
  toolsPath: string;
  /** Logs directory */
  logsPath: string;
  /** Model configuration */
  model: ModelConfig;
  /** Agent configuration */
  agent: AgentConfig;
  /** Debug mode */
  debug: boolean;
}

export interface ModelConfig {
  /** Primary model for main tasks */
  primaryModel: string;
  /** Utility model for summarization */
  utilityModel: string;
  /** Embedding model for memory */
  embeddingModel: string;
  /** Maximum tokens for responses */
  maxTokens: number;
  /** Temperature for responses */
  temperature: number;
}

export interface AgentConfig {
  /** Default agent profile */
  defaultProfile: string;
  /** Maximum subordinate agents */
  maxSubordinates: number;
  /** Enable autonomous mode */
  autonomousMode: boolean;
  /** Session timeout in minutes */
  sessionTimeout: number;
}

export interface SessionConfig {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'idle' | 'running' | 'paused' | 'stopped';
  profile: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

export const NEXUS_DIR_NAME = '.nexus';
export const DEFAULT_CONFIG_FILE = 'config.json';
export const SESSIONS_DIR = 'sessions';
export const SKILLS_DIR = 'skills';
export const MEMORY_DIR = 'memory';
export const TOOLS_DIR = 'tools';
export const LOGS_DIR = 'logs';

// ============================================================================
// Configuration Manager
// ============================================================================

export class ConfigManager {
  private config: NexusConfig;
  private configPath: string;

  constructor(customHome?: string) {
    const nexusHome = customHome || process.env.NEXUS_HOME || join(homedir(), NEXUS_DIR_NAME);
    this.configPath = join(nexusHome, DEFAULT_CONFIG_FILE);
    this.config = this.loadOrCreateConfig(nexusHome);
  }

  /**
   * Load existing config or create default
   */
  private loadOrCreateConfig(nexusHome: string): NexusConfig {
    // Create default config
    const defaultConfig = this.getDefaultConfig(nexusHome);

    // Check if config exists
    if (existsSync(this.configPath)) {
      try {
        const rawConfig = readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(rawConfig);
        // Merge with defaults to ensure all fields exist
        return this.mergeConfigs(defaultConfig, loadedConfig);
      } catch (error) {
        console.error('Failed to load config, using defaults:', error);
        return defaultConfig;
      }
    }

    // Create default config
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(nexusHome: string): NexusConfig {
    return {
      nexusHome,
      skillsPath: join(nexusHome, SKILLS_DIR),
      memoryPath: join(nexusHome, MEMORY_DIR),
      sessionsPath: join(nexusHome, SESSIONS_DIR),
      toolsPath: join(nexusHome, TOOLS_DIR),
      logsPath: join(nexusHome, LOGS_DIR),
      model: {
        primaryModel: process.env.NEXUS_PRIMARY_MODEL || 'gpt-4',
        utilityModel: process.env.NEXUS_UTILITY_MODEL || 'gpt-3.5-turbo',
        embeddingModel: process.env.NEXUS_EMBEDDING_MODEL || 'text-embedding-ada-002',
        maxTokens: parseInt(process.env.NEXUS_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.NEXUS_TEMPERATURE || '0.7'),
      },
      agent: {
        defaultProfile: process.env.NEXUS_DEFAULT_PROFILE || 'default',
        maxSubordinates: parseInt(process.env.NEXUS_MAX_SUBORDINATES || '5'),
        autonomousMode: process.env.NEXUS_AUTONOMOUS_MODE === 'true',
        sessionTimeout: parseInt(process.env.NEXUS_SESSION_TIMEOUT || '60'),
      },
      debug: process.env.NEXUS_DEBUG === 'true',
    };
  }

  /**
   * Merge configurations
   */
  private mergeConfigs(defaults: NexusConfig, loaded: Partial<NexusConfig>): NexusConfig {
    return {
      ...defaults,
      ...loaded,
      model: { ...defaults.model, ...loaded.model },
      agent: { ...defaults.agent, ...loaded.agent },
    };
  }

  /**
   * Save configuration to file
   */
  saveConfig(config?: NexusConfig): void {
    const configToSave = config || this.config;
    
    // Ensure directory exists
    const dir = join(this.configPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2));
  }

  /**
   * Get current configuration
   */
  getConfig(): NexusConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<NexusConfig>): NexusConfig {
    this.config = this.mergeConfigs(this.config, updates);
    this.saveConfig();
    return this.config;
  }

  /**
   * Initialize NEXUS directory structure
   */
  initializeDirectories(): void {
    const dirs = [
      this.config.nexusHome,
      this.config.skillsPath,
      this.config.memoryPath,
      this.config.sessionsPath,
      this.config.toolsPath,
      this.config.logsPath,
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        if (this.config.debug) {
          console.log(`Created directory: ${dir}`);
        }
      }
    }
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required paths
    if (!existsSync(this.config.nexusHome)) {
      errors.push(`NEXUS home directory does not exist: ${this.config.nexusHome}`);
    }

    // Validate model settings
    if (!this.config.model.primaryModel) {
      errors.push('Primary model is not configured');
    }

    // Validate agent settings
    if (this.config.agent.maxSubordinates < 1) {
      errors.push('Max subordinates must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get environment variables summary
   */
  getEnvSummary(): Record<string, string | undefined> {
    return {
      NEXUS_HOME: process.env.NEXUS_HOME,
      NEXUS_PRIMARY_MODEL: process.env.NEXUS_PRIMARY_MODEL,
      NEXUS_UTILITY_MODEL: process.env.NEXUS_UTILITY_MODEL,
      NEXUS_EMBEDDING_MODEL: process.env.NEXUS_EMBEDDING_MODEL,
      NEXUS_MAX_TOKENS: process.env.NEXUS_MAX_TOKENS,
      NEXUS_TEMPERATURE: process.env.NEXUS_TEMPERATURE,
      NEXUS_DEFAULT_PROFILE: process.env.NEXUS_DEFAULT_PROFILE,
      NEXUS_MAX_SUBORDINATES: process.env.NEXUS_MAX_SUBORDINATES,
      NEXUS_AUTONOMOUS_MODE: process.env.NEXUS_AUTONOMOUS_MODE,
      NEXUS_DEBUG: process.env.NEXUS_DEBUG,
    };
  }
}

// ============================================================================
// Session Manager
// ============================================================================

export class SessionManager {
  private config: NexusConfig;

  constructor(config: NexusConfig) {
    this.config = config;
  }

  /**
   * Create a new session
   */
  createSession(name?: string, profile?: string): SessionConfig {
    const id = this.generateSessionId();
    const now = new Date();
    
    const session: SessionConfig = {
      id,
      name: name || `session-${id.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      profile: profile || this.config.agent.defaultProfile,
      metadata: {},
    };

    this.saveSession(session);
    return session;
  }

  /**
   * Load a session by ID
   */
  loadSession(id: string): SessionConfig | null {
    const sessionPath = join(this.config.sessionsPath, `${id}.json`);
    
    if (!existsSync(sessionPath)) {
      return null;
    }

    try {
      const raw = readFileSync(sessionPath, 'utf-8');
      return JSON.parse(raw) as SessionConfig;
    } catch {
      return null;
    }
  }

  /**
   * Save a session
   */
  saveSession(session: SessionConfig): void {
    const sessionPath = join(this.config.sessionsPath, `${session.id}.json`);
    
    if (!existsSync(this.config.sessionsPath)) {
      mkdirSync(this.config.sessionsPath, { recursive: true });
    }

    writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  }

  /**
   * Update session status
   */
  updateSessionStatus(id: string, status: SessionConfig['status']): SessionConfig | null {
    const session = this.loadSession(id);
    if (!session) return null;

    session.status = status;
    session.updatedAt = new Date();
    this.saveSession(session);
    return session;
  }

  /**
   * List all sessions
   */
  listSessions(): SessionConfig[] {
    const sessions: SessionConfig[] = [];
    
    if (!existsSync(this.config.sessionsPath)) {
      return sessions;
    }

    // Use readdirSync from fs
    const files = readdirSync(this.config.sessionsPath);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const session = this.loadSession(file.replace('.json', ''));
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Delete a session
   */
  deleteSession(id: string): boolean {
    const sessionPath = join(this.config.sessionsPath, `${id}.json`);
    
    if (!existsSync(sessionPath)) {
      return false;
    }

    unlinkSync(sessionPath);
    return true;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

// ============================================================================
// Exports
// ============================================================================

let configManager: ConfigManager | null = null;
let sessionManager: SessionManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
}

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager(getConfigManager().getConfig());
  }
  return sessionManager;
}

export { join, homedir };
