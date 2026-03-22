/**
 * NEXUS Messaging Platform - WhatsApp Integration
 * 
 * Uses whatsapp-web.js for WhatsApp Web integration
 * Allows NEXUS to communicate via WhatsApp
 */

import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Types
export interface WhatsAppConfig {
  sessionPath: string;
  autoReply: boolean;
  allowedContacts: string[]; // Phone numbers or 'all'
  commandPrefix: string;
  maxMessageLength: number;
  rateLimit: {
    maxMessages: number;
    windowMs: number;
  };
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  isGroup: boolean;
  sender: {
    id: string;
    name?: string;
    pushname?: string;
  };
  quotedMessage?: WhatsAppMessage;
  media?: {
    type: 'image' | 'video' | 'audio' | 'document';
    mimeType: string;
    data?: Buffer;
    filename?: string;
  };
}

export interface WhatsAppContact {
  id: string;
  name?: string;
  pushname?: string;
  number: string;
  isGroup: boolean;
  isMe: boolean;
}

export interface SendMessageOptions {
  to: string;
  body: string;
  replyTo?: string;
  media?: {
    type: 'image' | 'video' | 'audio' | 'document';
    data: Buffer | string;
    mimeType?: string;
    filename?: string;
    caption?: string;
  };
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  sessionPath: '.nexus/whatsapp-session',
  autoReply: true,
  allowedContacts: ['all'],
  commandPrefix: '!nexus',
  maxMessageLength: 4096,
  rateLimit: {
    maxMessages: 20,
    windowMs: 60000 // 1 minute
  }
};

export class WhatsAppClient extends EventEmitter {
  private config: WhatsAppConfig;
  private client: any = null;
  private initialized: boolean = false;
  private ready: boolean = false;
  private messageQueue: WhatsAppMessage[] = [];
  private rateLimitTracker: Map<string, number[]> = new Map();

  constructor(config: Partial<WhatsAppConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[WhatsApp] Initializing...');

    // Ensure session directory exists
    if (!existsSync(this.config.sessionPath)) {
      mkdirSync(this.config.sessionPath, { recursive: true });
    }

    try {
      // Dynamic import of whatsapp-web.js
      const { Client, LocalAuth } = await import('whatsapp-web.js');

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: this.config.sessionPath
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      });

      this.setupEventHandlers();
      await this.client.initialize();

      this.initialized = true;
      console.log('[WhatsApp] Client initialized');

    } catch (error) {
      console.error('[WhatsApp] Failed to initialize:', error);
      console.log('[WhatsApp] Running in stub mode - messages will be queued');
      this.initialized = true;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('qr', (qr: string) => {
      console.log('[WhatsApp] QR Code received. Scan with WhatsApp mobile app.');
      this.emit('qr', qr);
    });

    this.client.on('ready', () => {
      console.log('[WhatsApp] Client is ready!');
      this.ready = true;
      this.emit('ready');
    });

    this.client.on('authenticated', () => {
      console.log('[WhatsApp] Authenticated successfully');
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error('[WhatsApp] Authentication failure:', msg);
      this.emit('auth_failure', msg);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log('[WhatsApp] Client was disconnected:', reason);
      this.ready = false;
      this.emit('disconnected', reason);
    });

    this.client.on('message', async (msg: any) => {
      try {
        const message = await this.parseMessage(msg);
        await this.handleIncomingMessage(message);
      } catch (error) {
        console.error('[WhatsApp] Error handling message:', error);
      }
    });

    this.client.on('message_create', async (msg: any) => {
      // Handle messages sent by us
      if (msg.fromMe) {
        this.emit('message_sent', {
          id: msg.id._serialized,
          to: msg.to,
          body: msg.body,
          timestamp: new Date(msg.timestamp * 1000)
        });
      }
    });
  }

  /**
   * Parse WhatsApp message to our format
   */
  private async parseMessage(msg: any): Promise<WhatsAppMessage> {
    const contact = await msg.getContact();
    const chat = await msg.getChat();

    let media: WhatsAppMessage['media'] = undefined;

    if (msg.hasMedia) {
      const mediaData = await msg.downloadMedia();
      media = {
        type: this.getMediaType(msg.type),
        mimeType: mediaData.mimetype,
        data: Buffer.from(mediaData.data, 'base64'),
        filename: msg.filename
      };
    }

    return {
      id: msg.id._serialized,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      timestamp: new Date(msg.timestamp * 1000),
      isGroup: chat.isGroup,
      sender: {
        id: contact.id._serialized,
        name: contact.name,
        pushname: contact.pushname
      },
      media
    };
  }

  /**
   * Get media type from message type
   */
  private getMediaType(type: string): 'image' | 'video' | 'audio' | 'document' {
    const typeMap: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
      'image': 'image',
      'video': 'video',
      'audio': 'audio',
      'ptt': 'audio',
      'document': 'document',
      'sticker': 'image'
    };
    return typeMap[type] || 'document';
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(message: WhatsAppMessage): Promise<void> {
    // Emit raw message event
    this.emit('message', message);

    // Check if auto-reply is enabled and message is allowed
    if (this.config.autoReply && this.isContactAllowed(message.from)) {
      // Check rate limit
      if (this.checkRateLimit(message.from)) {
        this.emit('message:rate_limited', message);
        return;
      }

      // Check if it's a command
      if (message.body.startsWith(this.config.commandPrefix)) {
        await this.handleCommand(message);
      } else {
        this.emit('message:needs_reply', message);
      }
    }
  }

  /**
   * Handle command message
   */
  private async handleCommand(message: WhatsAppMessage): Promise<void> {
    const command = message.body.slice(this.config.commandPrefix.length).trim();
    const [cmd, ...args] = command.split(/\s+/);

    this.emit('command', {
      message,
      command: cmd.toLowerCase(),
      args,
      raw: command
    });
  }

  /**
   * Check if contact is allowed
   */
  private isContactAllowed(contactId: string): boolean {
    if (this.config.allowedContacts.includes('all')) {
      return true;
    }
    return this.config.allowedContacts.some(allowed => 
      contactId.includes(allowed.replace(/[^0-9]/g, ''))
    );
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(contactId: string): boolean {
    const now = Date.now();
    const windowMs = this.config.rateLimit.windowMs;
    const maxMessages = this.config.rateLimit.maxMessages;

    let timestamps = this.rateLimitTracker.get(contactId) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= maxMessages) {
      return true; // Rate limited
    }

    timestamps.push(now);
    this.rateLimitTracker.set(contactId, timestamps);
    return false;
  }

  /**
   * Send a text message
   */
  async sendMessage(options: SendMessageOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!this.ready || !this.client) {
      // Queue message for later
      console.log('[WhatsApp] Client not ready, message queued');
      return { success: false, error: 'Client not ready' };
    }

    try {
      // Truncate message if needed
      let body = options.body;
      if (body.length > this.config.maxMessageLength) {
        body = body.slice(0, this.config.maxMessageLength - 3) + '...';
      }

      let result;

      if (options.media) {
        const { MessageMedia } = await import('whatsapp-web.js');
        const media = new MessageMedia(
          options.media.mimeType || 'application/octet-stream',
          Buffer.isBuffer(options.media.data) 
            ? options.media.data.toString('base64')
            : options.media.data,
          options.media.filename
        );

        result = await this.client.sendMessage(
          options.to,
          media,
          { caption: options.media.caption || body }
        );
      } else {
        result = await this.client.sendMessage(options.to, body);
      }

      return {
        success: true,
        id: result.id._serialized
      };

    } catch (error) {
      console.error('[WhatsApp] Failed to send message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reply to a message
   */
  async reply(messageId: string, body: string): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!this.ready || !this.client) {
      return { success: false, error: 'Client not ready' };
    }

    try {
      const msg = await this.client.getMessageById(messageId);
      const result = await msg.reply(body);

      return {
        success: true,
        id: result.id._serialized
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all contacts
   */
  async getContacts(): Promise<WhatsAppContact[]> {
    if (!this.ready || !this.client) {
      return [];
    }

    try {
      const contacts = await this.client.getContacts();
      
      return contacts.map((c: any) => ({
        id: c.id._serialized,
        name: c.name,
        pushname: c.pushname,
        number: c.number || c.id.user,
        isGroup: c.isGroup,
        isMe: c.isMe
      }));

    } catch (error) {
      console.error('[WhatsApp] Failed to get contacts:', error);
      return [];
    }
  }

  /**
   * Get chats
   */
  async getChats(): Promise<Array<{ id: string; name: string; unreadCount: number; lastMessage?: WhatsAppMessage }>> {
    if (!this.ready || !this.client) {
      return [];
    }

    try {
      const chats = await this.client.getChats();
      
      return chats.map((chat: any) => ({
        id: chat.id._serialized,
        name: chat.name,
        unreadCount: chat.unreadCount,
        lastMessage: chat.lastMessage ? {
          id: chat.lastMessage.id._serialized,
          from: chat.lastMessage.from,
          to: chat.lastMessage.to,
          body: chat.lastMessage.body,
          timestamp: new Date(chat.lastMessage.timestamp * 1000),
          isGroup: chat.isGroup,
          sender: { id: chat.lastMessage.from }
        } : undefined
      }));

    } catch (error) {
      console.error('[WhatsApp] Failed to get chats:', error);
      return [];
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    if (!this.ready || !this.client) {
      return false;
    }

    try {
      const msg = await this.client.getMessageById(messageId);
      await msg.getChat().then((chat: any) => chat.sendSeen());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Logout and destroy client
   */
  async logout(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
        await this.client.destroy();
      } catch (error) {
        console.error('[WhatsApp] Error during logout:', error);
      }
    }

    this.ready = false;
    this.initialized = false;
    this.client = null;
    
    this.emit('logout');
  }

  /**
   * Get QR code for authentication
   */
  async getQRCode(): Promise<string | null> {
    // QR code is emitted via 'qr' event
    // This method returns the last QR if cached
    return null;
  }
}

export default WhatsAppClient;
