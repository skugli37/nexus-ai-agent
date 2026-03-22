/**
 * NEXUS Messaging Platform - Telegram Integration
 * 
 * Uses Telegram Bot API for Telegram integration
 * Allows NEXUS to communicate via Telegram
 */

import { EventEmitter } from 'events';

// Types
export interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
  allowedChats: string[] | 'all';
  commandPrefix: string;
  parseMode: 'Markdown' | 'HTML' | 'MarkdownV2';
  maxMessageLength: number;
  rateLimit: {
    maxMessages: number;
    windowMs: number;
  };
}

export interface TelegramMessage {
  id: number;
  from: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    isBot: boolean;
    languageCode?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
  };
  date: Date;
  text?: string;
  caption?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
    url?: string;
    text?: string;
  }>;
  replyToMessage?: TelegramMessage;
  media?: {
    type: 'photo' | 'video' | 'audio' | 'document' | 'voice' | 'sticker';
    fileId: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
    fileName?: string;
  };
}

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  isBot: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  description?: string;
  memberCount?: number;
}

export interface SendMessageOptions {
  chatId: number | string;
  text: string;
  parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  disableNotification?: boolean;
  replyToMessageId?: number;
  disableWebPagePreview?: boolean;
  inlineKeyboard?: TelegramInlineKeyboard;
}

export interface TelegramInlineKeyboard {
  inlineKeyboard: Array<Array<{
    text: string;
    callbackData?: string;
    url?: string;
    switchInlineQuery?: string;
  }>>;
}

export interface TelegramUpdate {
  updateId: number;
  message?: TelegramMessage;
  editedMessage?: TelegramMessage;
  callbackQuery?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

const DEFAULT_CONFIG: Partial<TelegramConfig> = {
  allowedChats: 'all',
  commandPrefix: '/nexus',
  parseMode: 'Markdown',
  maxMessageLength: 4096,
  rateLimit: {
    maxMessages: 30,
    windowMs: 60000 // 1 minute
  }
};

export class TelegramClient extends EventEmitter {
  private config: TelegramConfig;
  private baseUrl: string;
  private initialized: boolean = false;
  private lastUpdateId: number = 0;
  private pollingInterval: NodeJS.Timeout | null = null;
  private rateLimitTracker: Map<number, number[]> = new Map();
  private botInfo: TelegramUser | null = null;

  constructor(config: TelegramConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as TelegramConfig;
    this.baseUrl = `https://api.telegram.org/bot${this.config.botToken}`;
  }

  /**
   * Initialize Telegram client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[Telegram] Initializing...');

    try {
      // Get bot info
      const me = await this.apiRequest('getMe');
      if (me.ok) {
        this.botInfo = me.result;
        console.log(`[Telegram] Connected as @${this.botInfo?.username}`);
      } else {
        throw new Error(me.description || 'Failed to get bot info');
      }

      // Setup webhook or polling
      if (this.config.webhookUrl) {
        await this.setupWebhook();
      } else {
        await this.startPolling();
      }

      this.initialized = true;
      this.emit('initialized', { bot: this.botInfo });

    } catch (error) {
      console.error('[Telegram] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Make API request to Telegram
   */
  private async apiRequest(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const url = `${this.baseUrl}/${method}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      return await response.json();

    } catch (error) {
      console.error(`[Telegram] API request failed (${method}):`, error);
      return { ok: false, description: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Setup webhook for receiving updates
   */
  private async setupWebhook(): Promise<void> {
    if (!this.config.webhookUrl) return;

    const result = await this.apiRequest('setWebhook', {
      url: this.config.webhookUrl,
      allowed_updates: ['message', 'edited_message', 'callback_query']
    });

    if (result.ok) {
      console.log('[Telegram] Webhook set successfully');
    } else {
      console.error('[Telegram] Failed to set webhook:', result.description);
    }
  }

  /**
   * Start long polling for updates
   */
  private async startPolling(): Promise<void> {
    console.log('[Telegram] Starting polling...');

    // Clear any existing webhook
    await this.apiRequest('deleteWebhook');

    // Start polling
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollUpdates();
      } catch (error) {
        console.error('[Telegram] Polling error:', error);
      }
    }, 1000);
  }

  /**
   * Poll for updates
   */
  private async pollUpdates(): Promise<void> {
    const result = await this.apiRequest('getUpdates', {
      offset: this.lastUpdateId + 1,
      limit: 100,
      timeout: 0,
      allowed_updates: ['message', 'edited_message', 'callback_query']
    });

    if (!result.ok || !result.result.length) {
      return;
    }

    for (const update of result.result) {
      this.lastUpdateId = update.update_id;
      await this.handleUpdate(update);
    }
  }

  /**
   * Handle incoming update
   */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    // Handle message
    if (update.message) {
      await this.handleMessage(update.message);
    }

    // Handle edited message
    if (update.editedMessage) {
      this.emit('message_edited', this.parseMessage(update.editedMessage));
    }

    // Handle callback query
    if (update.callbackQuery) {
      this.emit('callback_query', {
        id: update.callbackQuery.id,
        from: update.callbackQuery.from,
        message: update.callbackQuery.message ? this.parseMessage(update.callbackQuery.message) : undefined,
        data: update.callbackQuery.data
      });
    }
  }

  /**
   * Parse Telegram message to our format
   */
  private parseMessage(msg: any): TelegramMessage {
    return {
      id: msg.message_id,
      from: {
        id: msg.from.id,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name,
        username: msg.from.username,
        isBot: msg.from.is_bot,
        languageCode: msg.from.language_code
      },
      chat: {
        id: msg.chat.id,
        type: msg.chat.type,
        title: msg.chat.title,
        username: msg.chat.username
      },
      date: new Date(msg.date * 1000),
      text: msg.text,
      caption: msg.caption,
      entities: msg.entities,
      replyToMessage: msg.reply_to_message ? this.parseMessage(msg.reply_to_message) : undefined,
      media: this.extractMedia(msg)
    };
  }

  /**
   * Extract media from message
   */
  private extractMedia(msg: any): TelegramMessage['media'] {
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1]; // Get largest
      return {
        type: 'photo',
        fileId: photo.file_id,
        width: photo.width,
        height: photo.height,
        fileSize: photo.file_size
      };
    }

    if (msg.video) {
      return {
        type: 'video',
        fileId: msg.video.file_id,
        mimeType: msg.video.mime_type,
        width: msg.video.width,
        height: msg.video.height,
        duration: msg.video.duration,
        fileName: msg.video.file_name,
        fileSize: msg.video.file_size
      };
    }

    if (msg.audio) {
      return {
        type: 'audio',
        fileId: msg.audio.file_id,
        mimeType: msg.audio.mime_type,
        duration: msg.audio.duration,
        fileName: msg.audio.file_name,
        fileSize: msg.audio.file_size
      };
    }

    if (msg.document) {
      return {
        type: 'document',
        fileId: msg.document.file_id,
        mimeType: msg.document.mime_type,
        fileName: msg.document.file_name,
        fileSize: msg.document.file_size
      };
    }

    if (msg.voice) {
      return {
        type: 'voice',
        fileId: msg.voice.file_id,
        mimeType: msg.voice.mime_type,
        duration: msg.voice.duration,
        fileSize: msg.voice.file_size
      };
    }

    if (msg.sticker) {
      return {
        type: 'sticker',
        fileId: msg.sticker.file_id,
        width: msg.sticker.width,
        height: msg.sticker.height,
        fileSize: msg.sticker.file_size
      };
    }

    return undefined;
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(msg: any): Promise<void> {
    const message = this.parseMessage(msg);

    // Emit raw message event
    this.emit('message', message);

    // Check if chat is allowed
    if (!this.isChatAllowed(message.chat.id)) {
      return;
    }

    // Check rate limit
    if (this.checkRateLimit(message.chat.id)) {
      this.emit('message:rate_limited', message);
      return;
    }

    // Check if it's a command
    if (message.text?.startsWith(this.config.commandPrefix)) {
      await this.handleCommand(message);
    } else {
      this.emit('message:needs_reply', message);
    }
  }

  /**
   * Handle command message
   */
  private async handleCommand(message: TelegramMessage): Promise<void> {
    const text = message.text || '';
    const command = text.slice(this.config.commandPrefix.length).trim();
    const [cmd, ...args] = command.split(/\s+/);

    this.emit('command', {
      message,
      command: cmd.toLowerCase(),
      args,
      raw: command
    });
  }

  /**
   * Check if chat is allowed
   */
  private isChatAllowed(chatId: number): boolean {
    if (this.config.allowedChats === 'all') {
      return true;
    }

    return this.config.allowedChats.some(allowed => 
      String(chatId) === allowed
    );
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(chatId: number): boolean {
    const now = Date.now();
    const windowMs = this.config.rateLimit.windowMs;
    const maxMessages = this.config.rateLimit.maxMessages;

    let timestamps = this.rateLimitTracker.get(chatId) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= maxMessages) {
      return true; // Rate limited
    }

    timestamps.push(now);
    this.rateLimitTracker.set(chatId, timestamps);
    return false;
  }

  /**
   * Send a message
   */
  async sendMessage(options: SendMessageOptions): Promise<{ success: boolean; messageId?: number; error?: string }> {
    // Truncate message if needed
    let text = options.text;
    if (text.length > this.config.maxMessageLength) {
      text = text.slice(0, this.config.maxMessageLength - 3) + '...';
    }

    const params: Record<string, unknown> = {
      chat_id: options.chatId,
      text,
      parse_mode: options.parseMode || this.config.parseMode,
      disable_notification: options.disableNotification || false,
      disable_web_page_preview: options.disableWebPagePreview || false
    };

    if (options.replyToMessageId) {
      params.reply_to_message_id = options.replyToMessageId;
    }

    if (options.inlineKeyboard) {
      params.reply_markup = {
        inline_keyboard: options.inlineKeyboard.inlineKeyboard.map(row =>
          row.map(btn => ({
            text: btn.text,
            callback_data: btn.callbackData,
            url: btn.url,
            switch_inline_query: btn.switchInlineQuery
          }))
        )
      };
    }

    const result = await this.apiRequest('sendMessage', params);

    if (result.ok) {
      return {
        success: true,
        messageId: result.result.message_id
      };
    } else {
      return {
        success: false,
        error: result.description
      };
    }
  }

  /**
   * Reply to a message
   */
  async reply(chatId: number, text: string, replyToMessageId: number): Promise<{ success: boolean; messageId?: number; error?: string }> {
    return this.sendMessage({
      chatId,
      text,
      replyToMessageId
    });
  }

  /**
   * Send photo
   */
  async sendPhoto(chatId: number | string, photo: string | Buffer, caption?: string): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const params: Record<string, unknown> = {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: this.config.parseMode
    };

    const result = await this.apiRequest('sendPhoto', params);

    if (result.ok) {
      return { success: true, messageId: result.result.message_id };
    } else {
      return { success: false, error: result.description };
    }
  }

  /**
   * Send document
   */
  async sendDocument(chatId: number | string, document: string | Buffer, filename?: string, caption?: string): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const params: Record<string, unknown> = {
      chat_id: chatId,
      document,
      caption,
      parse_mode: this.config.parseMode
    };

    if (filename) {
      // Note: In real implementation, would need multipart/form-data
    }

    const result = await this.apiRequest('sendDocument', params);

    if (result.ok) {
      return { success: true, messageId: result.result.message_id };
    } else {
      return { success: false, error: result.description };
    }
  }

  /**
   * Edit message
   */
  async editMessage(chatId: number, messageId: number, text: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.apiRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: this.config.parseMode
    });

    return { success: result.ok, error: result.description };
  }

  /**
   * Delete message
   */
  async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    const result = await this.apiRequest('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });

    return result.ok;
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert?: boolean): Promise<boolean> {
    const result = await this.apiRequest('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert || false
    });

    return result.ok;
  }

  /**
   * Get chat
   */
  async getChat(chatId: number): Promise<TelegramChat | null> {
    const result = await this.apiRequest('getChat', { chat_id: chatId });

    if (result.ok) {
      return {
        id: result.result.id,
        type: result.result.type,
        title: result.result.title,
        username: result.result.username,
        description: result.result.description
      };
    }

    return null;
  }

  /**
   * Get bot info
   */
  getBotInfo(): TelegramUser | null {
    return this.botInfo;
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Stop polling and cleanup
   */
  async stop(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Delete webhook if set
    await this.apiRequest('deleteWebhook');

    this.initialized = false;
    this.emit('stopped');
  }

  /**
   * Set bot commands
   */
  async setCommands(commands: Array<{ command: string; description: string }>): Promise<boolean> {
    const result = await this.apiRequest('setMyCommands', { commands });
    return result.ok;
  }
}

export default TelegramClient;
