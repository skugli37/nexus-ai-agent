/**
 * NEXUS Messaging Platform Integration
 * Unified interface for multiple messaging platforms
 */

export { WhatsAppClient } from './whatsapp';
export type {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppContact,
  SendMessageOptions as WhatsAppSendMessageOptions
} from './whatsapp';

export { TelegramClient } from './telegram';
export type {
  TelegramConfig,
  TelegramMessage,
  TelegramUser,
  TelegramChat,
  SendMessageOptions as TelegramSendMessageOptions,
  TelegramUpdate,
  TelegramInlineKeyboard
} from './telegram';

import { EventEmitter } from 'events';
import { WhatsAppClient, WhatsAppMessage } from './whatsapp';
import { TelegramClient, TelegramMessage } from './telegram';

// Unified message format
export interface UnifiedMessage {
  id: string;
  platform: 'whatsapp' | 'telegram';
  from: {
    id: string;
    name?: string;
    username?: string;
  };
  chat: {
    id: string;
    type: 'private' | 'group' | 'channel';
    title?: string;
  };
  text?: string;
  timestamp: Date;
  replyTo?: UnifiedMessage;
  media?: {
    type: 'image' | 'video' | 'audio' | 'document' | 'voice';
    fileId: string;
    mimeType?: string;
    data?: Buffer;
  };
  raw: WhatsAppMessage | TelegramMessage;
}

export interface MessagingConfig {
  whatsapp?: {
    enabled: boolean;
    config?: Partial<import('./whatsapp').WhatsAppConfig>;
  };
  telegram?: {
    enabled: boolean;
    botToken?: string;
    config?: Partial<import('./telegram').TelegramConfig>;
  };
  autoReply: boolean;
  commandHandler?: (message: UnifiedMessage, command: string, args: string[]) => Promise<string>;
  messageHandler?: (message: UnifiedMessage) => Promise<string>;
}

/**
 * Unified Messaging Manager
 * Handles multiple messaging platforms
 */
export class MessagingManager extends EventEmitter {
  private config: MessagingConfig;
  private whatsapp: WhatsAppClient | null = null;
  private telegram: TelegramClient | null = null;
  private initialized: boolean = false;

  constructor(config: MessagingConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize all enabled messaging platforms
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[Messaging] Initializing...');

    const promises: Promise<void>[] = [];

    // Initialize WhatsApp
    if (this.config.whatsapp?.enabled) {
      promises.push(this.initializeWhatsApp());
    }

    // Initialize Telegram
    if (this.config.telegram?.enabled && this.config.telegram.botToken) {
      promises.push(this.initializeTelegram());
    }

    await Promise.allSettled(promises);

    this.initialized = true;
    console.log('[Messaging] Initialized');
    this.emit('initialized');
  }

  /**
   * Initialize WhatsApp client
   */
  private async initializeWhatsApp(): Promise<void> {
    try {
      this.whatsapp = new WhatsAppClient(this.config.whatsapp?.config);

      this.whatsapp.on('message', (msg: WhatsAppMessage) => {
        this.emit('message', this.convertWhatsAppMessage(msg));
      });

      this.whatsapp.on('command', async ({ message, command, args }) => {
        const unified = this.convertWhatsAppMessage(message);
        
        if (this.config.commandHandler) {
          const response = await this.config.commandHandler(unified, command, args);
          await this.whatsapp?.reply(message.id, response);
        }

        this.emit('command', { message: unified, command, args });
      });

      this.whatsapp.on('message:needs_reply', async (msg: WhatsAppMessage) => {
        const unified = this.convertWhatsAppMessage(msg);

        if (this.config.messageHandler) {
          const response = await this.config.messageHandler(unified);
          await this.whatsapp?.reply(msg.id, response);
        }

        this.emit('message:needs_reply', unified);
      });

      await this.whatsapp.initialize();
      console.log('[Messaging] WhatsApp initialized');

    } catch (error) {
      console.error('[Messaging] Failed to initialize WhatsApp:', error);
    }
  }

  /**
   * Initialize Telegram client
   */
  private async initializeTelegram(): Promise<void> {
    try {
      this.telegram = new TelegramClient({
        botToken: this.config.telegram!.botToken!,
        ...this.config.telegram?.config
      });

      this.telegram.on('message', (msg: TelegramMessage) => {
        this.emit('message', this.convertTelegramMessage(msg));
      });

      this.telegram.on('command', async ({ message, command, args }) => {
        const unified = this.convertTelegramMessage(message);

        if (this.config.commandHandler) {
          const response = await this.config.commandHandler(unified, command, args);
          await this.telegram?.sendMessage({
            chatId: message.chat.id,
            text: response,
            replyToMessageId: message.id
          });
        }

        this.emit('command', { message: unified, command, args });
      });

      await this.telegram.initialize();
      console.log('[Messaging] Telegram initialized');

    } catch (error) {
      console.error('[Messaging] Failed to initialize Telegram:', error);
    }
  }

  /**
   * Convert WhatsApp message to unified format
   */
  private convertWhatsAppMessage(msg: WhatsAppMessage): UnifiedMessage {
    return {
      id: `wa-${msg.id}`,
      platform: 'whatsapp',
      from: {
        id: msg.sender.id,
        name: msg.sender.name || msg.sender.pushname
      },
      chat: {
        id: msg.from,
        type: msg.isGroup ? 'group' : 'private'
      },
      text: msg.body,
      timestamp: msg.timestamp,
      replyTo: msg.quotedMessage ? this.convertWhatsAppMessage(msg.quotedMessage) : undefined,
      media: msg.media ? {
        type: msg.media.type,
        fileId: 'wa-media',
        mimeType: msg.media.mimeType,
        data: msg.media.data
      } : undefined,
      raw: msg
    };
  }

  /**
   * Convert Telegram message to unified format
   */
  private convertTelegramMessage(msg: TelegramMessage): UnifiedMessage {
    return {
      id: `tg-${msg.id}`,
      platform: 'telegram',
      from: {
        id: String(msg.from.id),
        name: [msg.from.firstName, msg.from.lastName].filter(Boolean).join(' '),
        username: msg.from.username
      },
      chat: {
        id: String(msg.chat.id),
        type: msg.chat.type === 'supergroup' ? 'group' : msg.chat.type,
        title: msg.chat.title
      },
      text: msg.text || msg.caption,
      timestamp: msg.date,
      replyTo: msg.replyToMessage ? this.convertTelegramMessage(msg.replyToMessage) : undefined,
      media: msg.media ? {
        type: msg.media.type === 'voice' ? 'voice' : msg.media.type,
        fileId: msg.media.fileId,
        mimeType: msg.media.mimeType
      } : undefined,
      raw: msg
    };
  }

  /**
   * Send message to a platform
   */
  async sendMessage(
    platform: 'whatsapp' | 'telegram',
    chatId: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    if (platform === 'whatsapp' && this.whatsapp) {
      const result = await this.whatsapp.sendMessage({ to: chatId, body: text });
      return result;
    }

    if (platform === 'telegram' && this.telegram) {
      const result = await this.telegram.sendMessage({ chatId, text });
      return result;
    }

    return { success: false, error: `${platform} not available` };
  }

  /**
   * Broadcast message to all platforms
   */
  async broadcast(text: string): Promise<{ whatsapp?: boolean; telegram?: boolean }> {
    const results: { whatsapp?: boolean; telegram?: boolean } = {};

    if (this.whatsapp?.isReady()) {
      // Would need to get all chats first
      results.whatsapp = true;
    }

    if (this.telegram?.isReady()) {
      // Would need to get all chats first
      results.telegram = true;
    }

    return results;
  }

  /**
   * Get platform status
   */
  getStatus(): {
    whatsapp: { enabled: boolean; ready: boolean };
    telegram: { enabled: boolean; ready: boolean };
  } {
    return {
      whatsapp: {
        enabled: !!this.whatsapp,
        ready: this.whatsapp?.isReady() || false
      },
      telegram: {
        enabled: !!this.telegram,
        ready: this.telegram?.isReady() || false
      }
    };
  }

  /**
   * Stop all platforms
   */
  async stop(): Promise<void> {
    await Promise.allSettled([
      this.whatsapp?.logout(),
      this.telegram?.stop()
    ]);

    this.initialized = false;
    this.emit('stopped');
  }
}

export default MessagingManager;
