/**
 * NEXUS Unified Messaging Manager
 * 
 * Provides a unified interface for managing multiple messaging platforms.
 * Handles platform registration, message routing, broadcasting, and event management.
 */

import { EventEmitter } from 'events';
import {
  MessagingPlatform,
  MessagingPlatformType,
  Message,
  MessageStatus,
  SendOptions,
  BroadcastMessage,
  BroadcastResult,
  BroadcastTarget,
  MessagingEvent,
  MessagingEventHandler,
  MessagingEventType,
  MessagingError,
  RateLimitConfig,
  QueuedMessage,
  WhatsAppConfig,
  TelegramConfig,
} from './types';
import { WhatsAppClient, createWhatsAppClient } from './whatsapp';
import { TelegramClient, createTelegramClient, createInlineKeyboard } from './telegram';

/**
 * Messaging Manager Configuration
 */
export interface MessagingManagerConfig {
  /** Enable message queuing */
  enableQueue?: boolean;
  /** Maximum queue size per platform */
  maxQueueSize?: number;
  /** Enable message broadcasting */
  enableBroadcast?: boolean;
  /** Enable event logging */
  enableLogging?: boolean;
  /** Default parse mode */
  defaultParseMode?: 'none' | 'markdown' | 'html';
}

/**
 * Platform Registration
 */
interface PlatformRegistration {
  platform: MessagingPlatform;
  enabled: boolean;
  priority: number;
  registeredAt: Date;
}

/**
 * Message Handler
 */
type MessageHandler = (message: Message) => void | Promise<void>;

/**
 * Unified Messaging Manager
 */
export class MessagingManager extends EventEmitter {
  private config: MessagingManagerConfig;
  private platforms: Map<MessagingPlatformType, PlatformRegistration> = new Map();
  private messageHandlers: MessageHandler[] = [];
  private broadcasts: Map<string, BroadcastMessage> = new Map();
  private messageQueue: QueuedMessage[] = [];
  private queueProcessing: boolean = false;

  constructor(config: MessagingManagerConfig = {}) {
    super();
    this.config = {
      enableQueue: true,
      maxQueueSize: 1000,
      enableBroadcast: true,
      enableLogging: false,
      defaultParseMode: 'none',
      ...config,
    };
  }

  // ============================================================================
  // PLATFORM MANAGEMENT
  // ============================================================================

  /**
   * Register a messaging platform
   */
  registerPlatform(platform: MessagingPlatform, options: {
    enabled?: boolean;
    priority?: number;
  } = {}): void {
    const registration: PlatformRegistration = {
      platform,
      enabled: options.enabled ?? true,
      priority: options.priority ?? 0,
      registeredAt: new Date(),
    };

    this.platforms.set(platform.platformType, registration);

    // Forward platform events - platforms extend EventEmitter
    const eventEmitter = platform as unknown as EventEmitter;
    if (typeof eventEmitter.on === 'function') {
      this.forwardPlatformEvents(platform);
    }

    if (this.config.enableLogging) {
      console.log(`[MessagingManager] Registered platform: ${platform.platformType}`);
    }
  }

  /**
   * Forward platform events to manager
   */
  private forwardPlatformEvents(platform: MessagingPlatform): void {
    const eventTypes: MessagingEventType[] = [
      'message:received',
      'message:sent',
      'message:delivered',
      'message:read',
      'message:failed',
      'platform:connected',
      'platform:disconnected',
    ];

    eventTypes.forEach(eventType => {
      const eventEmitter = platform as unknown as EventEmitter;
      if (typeof eventEmitter.on === 'function') {
        eventEmitter.on(eventType, (event: MessagingEvent) => {
        this.emit(eventType, event);
        
        // Handle message routing
          if (eventType === 'message:received') {
            this.handleIncomingMessage(event.data.message as Message);
          }
        });
      }
    });
  }

  /**
   * Unregister a messaging platform
   */
  async unregisterPlatform(platformType: MessagingPlatformType): Promise<void> {
    const registration = this.platforms.get(platformType);
    
    if (registration) {
      await registration.platform.disconnect();
      this.platforms.delete(platformType);
      
      if (this.config.enableLogging) {
        console.log(`[MessagingManager] Unregistered platform: ${platformType}`);
      }
    }
  }

  /**
   * Get registered platform
   */
  getPlatform(platformType: MessagingPlatformType): MessagingPlatform | null {
    const registration = this.platforms.get(platformType);
    return registration?.enabled ? registration.platform : null;
  }

  /**
   * Get all registered platforms
   */
  getPlatforms(): MessagingPlatformType[] {
    return Array.from(this.platforms.keys());
  }

  /**
   * Enable or disable a platform
   */
  setPlatformEnabled(platformType: MessagingPlatformType, enabled: boolean): void {
    const registration = this.platforms.get(platformType);
    if (registration) {
      registration.enabled = enabled;
    }
  }

  /**
   * Check if platform is available
   */
  isPlatformAvailable(platformType: MessagingPlatformType): boolean {
    const registration = this.platforms.get(platformType);
    return registration?.enabled && registration.platform.isConnected;
  }

  // ============================================================================
  // PLATFORM FACTORY METHODS
  // ============================================================================

  /**
   * Create and register WhatsApp client
   */
  async createWhatsAppClient(config: WhatsAppConfig): Promise<WhatsAppClient> {
    const client = createWhatsAppClient(config);
    await client.initialize();
    this.registerPlatform(client);
    return client;
  }

  /**
   * Create and register Telegram client
   */
  async createTelegramClient(config: TelegramConfig): Promise<TelegramClient> {
    const client = createTelegramClient(config);
    await client.initialize();
    this.registerPlatform(client);
    return client;
  }

  // ============================================================================
  // MESSAGE SENDING
  // ============================================================================

  /**
   * Send a text message to a specific platform
   */
  async sendMessage(
    platformType: MessagingPlatformType,
    to: string,
    text: string,
    options?: SendOptions
  ): Promise<string> {
    const platform = this.getPlatform(platformType);
    
    if (!platform) {
      throw new MessagingError(
        'PLATFORM_NOT_CONNECTED',
        `Platform ${platformType} is not available`,
        platformType
      );
    }

    return platform.sendMessage(to, text, {
      ...options,
      parseMode: options?.parseMode || this.config.defaultParseMode,
    });
  }

  /**
   * Send an image message
   */
  async sendImage(
    platformType: MessagingPlatformType,
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<string> {
    const platform = this.getPlatform(platformType);
    
    if (!platform) {
      throw new MessagingError(
        'PLATFORM_NOT_CONNECTED',
        `Platform ${platformType} is not available`,
        platformType
      );
    }

    return platform.sendImage(to, imageUrl, caption);
  }

  /**
   * Send a document
   */
  async sendDocument(
    platformType: MessagingPlatformType,
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string
  ): Promise<string> {
    const platform = this.getPlatform(platformType);
    
    if (!platform) {
      throw new MessagingError(
        'PLATFORM_NOT_CONNECTED',
        `Platform ${platformType} is not available`,
        platformType
      );
    }

    return platform.sendDocument(to, documentUrl, filename, caption);
  }

  /**
   * Send message to best available platform
   */
  async sendToBestAvailable(to: string, text: string, options?: SendOptions): Promise<{
    platform: MessagingPlatformType;
    messageId: string;
  }> {
    // Sort platforms by priority
    const sortedPlatforms = Array.from(this.platforms.entries())
      .filter(([_, reg]) => reg.enabled && reg.platform.isConnected)
      .sort((a, b) => b[1].priority - a[1].priority);

    if (sortedPlatforms.length === 0) {
      throw new MessagingError(
        'PLATFORM_NOT_CONNECTED',
        'No messaging platforms available',
        undefined
      );
    }

    // Try each platform in order
    for (const [platformType, registration] of sortedPlatforms) {
      try {
        const messageId = await registration.platform.sendMessage(to, text, options);
        return { platform: platformType, messageId };
      } catch (error) {
        if (this.config.enableLogging) {
          console.error(`[MessagingManager] Failed to send via ${platformType}:`, error);
        }
        continue;
      }
    }

    throw new MessagingError(
      'API_ERROR',
      'Failed to send message via any available platform',
      undefined
    );
  }

  // ============================================================================
  // BROADCAST MESSAGING
  // ============================================================================

  /**
   * Broadcast a message to multiple recipients across platforms
   */
  async broadcast(
    text: string,
    targets: BroadcastTarget[],
    options?: SendOptions
  ): Promise<BroadcastResult> {
    if (!this.config.enableBroadcast) {
      throw new MessagingError(
        'API_ERROR',
        'Broadcast is not enabled',
        undefined
      );
    }

    const broadcastId = this.generateBroadcastId();
    const broadcast: BroadcastMessage = {
      id: broadcastId,
      content: text,
      targets,
      createdAt: new Date(),
      status: new Map(),
    };

    this.broadcasts.set(broadcastId, broadcast);

    const result: BroadcastResult = {
      broadcastId,
      totalRecipients: targets.reduce((sum, t) => sum + t.recipients.length, 0),
      sent: 0,
      failed: 0,
      results: new Map(),
    };

    // Send to each target
    for (const target of targets) {
      const platform = this.getPlatform(target.platform);
      
      if (!platform) {
        target.recipients.forEach(recipient => {
          result.failed++;
          result.results.set(recipient, {
            success: false,
            error: `Platform ${target.platform} not available`,
          });
        });
        continue;
      }

      // Send to each recipient
      for (const recipient of target.recipients) {
        try {
          const messageId = await platform.sendMessage(recipient, text, options);
          result.sent++;
          result.results.set(recipient, { success: true, messageId });
          broadcast.status.set(recipient, 'sent');
        } catch (error) {
          result.failed++;
          result.results.set(recipient, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          broadcast.status.set(recipient, 'failed');
        }
      }
    }

    return result;
  }

  /**
   * Get broadcast status
   */
  getBroadcastStatus(broadcastId: string): BroadcastMessage | null {
    return this.broadcasts.get(broadcastId) || null;
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(message: Message): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(message);
      } catch (error) {
        if (this.config.enableLogging) {
          console.error('[MessagingManager] Message handler error:', error);
        }
      }
    }
  }

  /**
   * Handle webhook for a specific platform
   */
  async handleWebhook(platformType: MessagingPlatformType, body: unknown): Promise<Message | null> {
    const platform = this.getPlatform(platformType);
    
    if (!platform) {
      throw new MessagingError(
        'PLATFORM_NOT_CONNECTED',
        `Platform ${platformType} is not available`,
        platformType
      );
    }

    return platform.handleWebhook(body);
  }

  // ============================================================================
  // MESSAGE STATUS
  // ============================================================================

  /**
   * Get message status
   */
  async getMessageStatus(
    platformType: MessagingPlatformType,
    messageId: string
  ): Promise<MessageStatus> {
    const platform = this.getPlatform(platformType);
    
    if (!platform) {
      throw new MessagingError(
        'PLATFORM_NOT_CONNECTED',
        `Platform ${platformType} is not available`,
        platformType
      );
    }

    return platform.getMessageStatus(messageId);
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    platformType: MessagingPlatformType,
    messageIds: string[]
  ): Promise<void> {
    const platform = this.getPlatform(platformType);
    
    if (!platform) {
      throw new MessagingError(
        'PLATFORM_NOT_CONNECTED',
        `Platform ${platformType} is not available`,
        platformType
      );
    }

    return platform.markAsRead(messageIds);
  }

  // ============================================================================
  // MESSAGE FORMATTING
  // ============================================================================

  /**
   * Format message for a specific platform
   */
  formatMessage(
    platformType: MessagingPlatformType,
    text: string,
    format: 'plain' | 'markdown' | 'html' = 'plain'
  ): string {
    switch (platformType) {
      case 'telegram':
        return this.formatForTelegram(text, format);
      case 'whatsapp':
        return this.formatForWhatsApp(text, format);
      default:
        return text;
    }
  }

  /**
   * Format for Telegram (supports HTML and MarkdownV2)
   */
  private formatForTelegram(text: string, format: string): string {
    if (format === 'plain') {
      // Escape special characters for Telegram
      return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }
    return text;
  }

  /**
   * Format for WhatsApp (limited formatting support)
   */
  private formatForWhatsApp(text: string, format: string): string {
    if (format === 'plain') {
      return text;
    }
    
    // Convert markdown to WhatsApp format
    // *bold* -> *bold*
    // _italic_ -> _italic_
    // `code` -> ```code```
    // ~strikethrough~ -> ~strikethrough~
    
    return text
      .replace(/\*\*(.+?)\*\*/g, '*$1*')
      .replace(/__(.+?)__/g, '_$1_')
      .replace(/`(.+?)`/g, '```$1```');
  }

  // ============================================================================
  // LIFE CYCLE
  // ============================================================================

  /**
   * Initialize all registered platforms
   */
  async initialize(): Promise<void> {
    const initPromises = Array.from(this.platforms.values())
      .filter(reg => reg.enabled)
      .map(reg => reg.platform.initialize());

    await Promise.allSettled(initPromises);

    if (this.config.enableLogging) {
      console.log('[MessagingManager] Initialized');
    }
  }

  /**
   * Disconnect all platforms
   */
  async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.platforms.values())
      .map(reg => reg.platform.disconnect());

    await Promise.allSettled(disconnectPromises);
    this.platforms.clear();
    this.messageHandlers = [];
    this.broadcasts.clear();
    this.messageQueue = [];

    if (this.config.enableLogging) {
      console.log('[MessagingManager] Disconnected');
    }
  }

  /**
   * Get manager status
   */
  getStatus(): {
    platforms: Array<{
      type: MessagingPlatformType;
      enabled: boolean;
      connected: boolean;
      priority: number;
    }>;
    queuedMessages: number;
    activeBroadcasts: number;
    handlers: number;
  } {
    return {
      platforms: Array.from(this.platforms.entries()).map(([type, reg]) => ({
        type,
        enabled: reg.enabled,
        connected: reg.platform.isConnected,
        priority: reg.priority,
      })),
      queuedMessages: this.messageQueue.length,
      activeBroadcasts: this.broadcasts.size,
      handlers: this.messageHandlers.length,
    };
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Subscribe to messaging events
   */
  subscribe(eventType: MessagingEventType, handler: MessagingEventHandler): () => void {
    this.on(eventType, handler);
    return () => this.off(eventType, handler);
  }

  /**
   * Emit a messaging event
   */
  emitEvent(event: MessagingEvent): void {
    this.emit(event.type, event);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Generate broadcast ID
   */
  private generateBroadcastId(): string {
    return `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let defaultManager: MessagingManager | null = null;

/**
 * Get the default messaging manager instance
 */
export function getMessagingManager(config?: MessagingManagerConfig): MessagingManager {
  if (!defaultManager) {
    defaultManager = new MessagingManager(config);
  }
  return defaultManager;
}

/**
 * Create a new messaging manager instance
 */
export function createMessagingManager(config?: MessagingManagerConfig): MessagingManager {
  return new MessagingManager(config);
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export {
  WhatsAppClient,
  createWhatsAppClient,
  TelegramClient,
  createTelegramClient,
  createInlineKeyboard,
};
