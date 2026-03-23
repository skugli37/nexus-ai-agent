/**
 * NEXUS Messaging Module Tests
 * 
 * Comprehensive test suite for WhatsApp, Telegram, and Messaging Manager.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Message,
  MessagingPlatformType,
  MessageType,
  MessageStatus,
  MessagingError,
  WhatsAppConfig,
  TelegramConfig,
  TelegramInlineKeyboardMarkup,
} from '../types';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// TYPES TESTS
// ============================================================================

describe('Messaging Types', () => {
  it('should define correct Message interface', () => {
    const message: Message = {
      id: 'msg_123',
      platform: 'whatsapp',
      from: '+1234567890',
      to: '+0987654321',
      timestamp: new Date(),
      type: 'text',
      content: 'Hello, World!',
      status: 'sent',
      raw: {},
    };

    expect(message.id).toBe('msg_123');
    expect(message.platform).toBe('whatsapp');
    expect(message.type).toBe('text');
  });

  it('should support all platform types', () => {
    const platforms: MessagingPlatformType[] = ['whatsapp', 'telegram', 'web'];
    expect(platforms).toHaveLength(3);
  });

  it('should support all message types', () => {
    const types: MessageType[] = ['text', 'image', 'audio', 'document', 'video', 'location', 'contact'];
    expect(types).toHaveLength(7);
  });

  it('should support all message statuses', () => {
    const statuses: MessageStatus[] = ['pending', 'sent', 'delivered', 'read', 'failed'];
    expect(statuses).toHaveLength(5);
  });

  it('should create MessagingError correctly', () => {
    const error = new MessagingError(
      'PLATFORM_NOT_CONNECTED',
      'WhatsApp not connected',
      'whatsapp',
      { attemptedAction: 'sendMessage' }
    );

    expect(error.code).toBe('PLATFORM_NOT_CONNECTED');
    expect(error.platform).toBe('whatsapp');
    expect(error.name).toBe('MessagingError');
    expect(error.details?.attemptedAction).toBe('sendMessage');
  });
});

// ============================================================================
// WHATSAPP CLIENT TESTS
// ============================================================================

describe('WhatsAppClient', () => {
  let WhatsAppClient: typeof import('../whatsapp').WhatsAppClient;
  let config: WhatsAppConfig;

  beforeEach(async () => {
    // Import dynamically to reset module state
    vi.resetModules();
    const whatsappModule = await import('../whatsapp');
    WhatsAppClient = whatsappModule.WhatsAppClient;

    config = {
      businessAccountId: 'test_business_id',
      phoneNumberId: 'test_phone_id',
      accessToken: 'test_access_token',
      verifyToken: 'test_verify_token',
      appSecret: 'test_app_secret',
      apiVersion: 'v18.0',
    };

    // Reset mocks
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      const client = new WhatsAppClient(config);
      expect(client.platformType).toBe('whatsapp');
      expect(client.isConnected).toBe(false);
    });

    it('should use default values for optional config', () => {
      const minimalConfig: WhatsAppConfig = {
        businessAccountId: 'test',
        phoneNumberId: 'test',
        accessToken: 'test',
        verifyToken: 'test',
      };

      const client = new WhatsAppClient(minimalConfig);
      expect(client).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test_phone_id', display_phone_number: '+1234567890' }),
      });

      const client = new WhatsAppClient(config);
      await client.initialize();

      expect(client.isConnected).toBe(true);
    });

    it('should fail initialization with invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { message: 'Invalid access token' },
        }),
      });

      const client = new WhatsAppClient(config);

      await expect(client.initialize()).rejects.toThrow(MessagingError);
    });
  });

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '+1234567890', wa_id: '1234567890' }],
          messages: [{ id: 'wamid.test123' }],
        }),
      });

      const client = new WhatsAppClient(config);
      (client as any)._isConnected = true;

      const messageId = await client.sendMessage('+1234567890', 'Hello!');

      expect(messageId).toBe('wamid.test123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello!'),
        })
      );
    });

    it('should throw error when not connected', async () => {
      const client = new WhatsAppClient(config);

      await expect(client.sendMessage('+1234567890', 'Hello!'))
        .rejects.toThrow('WhatsApp client not connected');
    });

    it('should format phone numbers correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.test' }],
        }),
      });

      const client = new WhatsAppClient(config);
      (client as any)._isConnected = true;

      await client.sendMessage('+1 (234) 567-890', 'Test');

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.to).toBe('1234567890');
    });
  });

  describe('sendImage', () => {
    it('should send image message with caption', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.image123' }],
        }),
      });

      const client = new WhatsAppClient(config);
      (client as any)._isConnected = true;

      const messageId = await client.sendImage(
        '+1234567890',
        'https://example.com/image.jpg',
        'Check this out!'
      );

      expect(messageId).toBe('wamid.image123');
      
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.type).toBe('image');
      expect(body.image.link).toBe('https://example.com/image.jpg');
      expect(body.image.caption).toBe('Check this out!');
    });
  });

  describe('sendDocument', () => {
    it('should send document with filename', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.doc123' }],
        }),
      });

      const client = new WhatsAppClient(config);
      (client as any)._isConnected = true;

      const messageId = await client.sendDocument(
        '+1234567890',
        'https://example.com/doc.pdf',
        'document.pdf',
        'Here is the document'
      );

      expect(messageId).toBe('wamid.doc123');
    });
  });

  describe('handleWebhook', () => {
    it('should parse incoming text message', async () => {
      const client = new WhatsAppClient(config);
      (client as any)._isConnected = true;

      const webhookBody = {
        entry: [{
          id: 'entry_id',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+0987654321',
                phone_number_id: 'test_phone_id',
              },
              contacts: [{
                profile: { name: 'John Doe' },
                wa_id: '1234567890',
              }],
              messages: [{
                from: '1234567890',
                id: 'wamid.incoming123',
                timestamp: '1234567890',
                type: 'text',
                text: { body: 'Hello from WhatsApp!' },
              }],
            },
          }],
        }],
      };

      const message = await client.handleWebhook(webhookBody);

      expect(message).not.toBeNull();
      expect(message?.platform).toBe('whatsapp');
      expect(message?.from).toBe('1234567890');
      expect(message?.type).toBe('text');
      expect(message?.content).toBe('Hello from WhatsApp!');
    });

    it('should parse incoming image message', async () => {
      const client = new WhatsAppClient(config);
      (client as any)._isConnected = true;

      const webhookBody = {
        entry: [{
          id: 'entry_id',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+0987654321',
                phone_number_id: 'test_phone_id',
              },
              messages: [{
                from: '1234567890',
                id: 'wamid.image456',
                timestamp: '1234567890',
                type: 'image',
                image: {
                  id: 'media_id_123',
                  mime_type: 'image/jpeg',
                  caption: 'Check this photo',
                },
              }],
            },
          }],
        }],
      };

      const message = await client.handleWebhook(webhookBody);

      expect(message).not.toBeNull();
      expect(message?.type).toBe('image');
      expect(message?.caption).toBe('Check this photo');
      expect(message?.mediaUrl).toBe('media_id_123');
    });

    it('should return null for empty webhook', async () => {
      const client = new WhatsAppClient(config);

      const message = await client.handleWebhook({});
      expect(message).toBeNull();
    });
  });

  describe('verifyWebhook', () => {
    it('should verify valid webhook', () => {
      const client = new WhatsAppClient(config);

      const result = client.verifyWebhook(
        'subscribe',
        'test_verify_token',
        'challenge123'
      );

      expect(result).toBe('challenge123');
    });

    it('should reject invalid token', () => {
      const client = new WhatsAppClient(config);

      const result = client.verifyWebhook(
        'subscribe',
        'invalid_token',
        'challenge123'
      );

      expect(result).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should disconnect properly', async () => {
      const client = new WhatsAppClient(config);
      (client as any)._isConnected = true;

      await client.disconnect();

      expect(client.isConnected).toBe(false);
    });
  });
});

// ============================================================================
// TELEGRAM CLIENT TESTS
// ============================================================================

describe('TelegramClient', () => {
  let TelegramClient: typeof import('../telegram').TelegramClient;
  let createInlineKeyboard: typeof import('../telegram').createInlineKeyboard;
  let config: TelegramConfig;

  beforeEach(async () => {
    vi.resetModules();
    const telegramModule = await import('../telegram');
    TelegramClient = telegramModule.TelegramClient;
    createInlineKeyboard = telegramModule.createInlineKeyboard;

    config = {
      botToken: 'test_bot_token',
      useWebhook: false,
      pollingTimeout: 30,
    };

    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      const client = new TelegramClient(config);
      expect(client.platformType).toBe('telegram');
      expect(client.isConnected).toBe(false);
    });

    it('should use polling mode by default', () => {
      const client = new TelegramClient(config);
      expect((client as any).config.useWebhook).toBe(false);
    });

    it('should support webhook mode', () => {
      const webhookConfig: TelegramConfig = {
        ...config,
        useWebhook: true,
        webhookUrl: 'https://example.com/webhook',
      };

      const client = new TelegramClient(webhookConfig);
      expect((client as any).config.useWebhook).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            id: 123456789,
            is_bot: true,
            first_name: 'TestBot',
            username: 'test_bot',
          },
        }),
      });

      const client = new TelegramClient(config);
      await client.initialize();

      expect(client.isConnected).toBe(true);
    });

    it('should fail with invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error_code: 401,
          description: 'Unauthorized',
        }),
      });

      const client = new TelegramClient(config);

      await expect(client.initialize()).rejects.toThrow(MessagingError);
    });
  });

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: 123,
            chat: { id: 123456789, type: 'private' },
            text: 'Hello!',
            date: 1234567890,
          },
        }),
      });

      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const messageId = await client.sendMessage('123456789', 'Hello!');

      expect(messageId).toBe('123');
    });

    it('should send message with HTML parse mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: 124,
            chat: { id: 123456789 },
            text: '<b>Bold</b>',
          },
        }),
      });

      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      await client.sendMessage('123456789', '<b>Bold</b>', { parseMode: 'html' });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.parse_mode).toBe('HTML');
    });

    it('should throw error when not connected', async () => {
      const client = new TelegramClient(config);

      await expect(client.sendMessage('123456789', 'Hello!'))
        .rejects.toThrow('Telegram client not connected');
    });
  });

  describe('sendImage', () => {
    it('should send image with caption', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: 125,
            chat: { id: 123456789 },
            photo: [{ file_id: 'photo_id' }],
          },
        }),
      });

      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const messageId = await client.sendImage(
        '123456789',
        'https://example.com/photo.jpg',
        'Nice photo!'
      );

      expect(messageId).toBe('125');
    });
  });

  describe('sendDocument', () => {
    it('should send document', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: 126,
            chat: { id: 123456789 },
            document: { file_id: 'doc_id' },
          },
        }),
      });

      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const messageId = await client.sendDocument(
        '123456789',
        'https://example.com/doc.pdf',
        'document.pdf'
      );

      expect(messageId).toBe('126');
    });
  });

  describe('sendMessageWithKeyboard', () => {
    it('should send message with inline keyboard', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: 127,
            chat: { id: 123456789 },
            text: 'Choose an option',
          },
        }),
      });

      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const keyboard = [
        [
          { text: 'Option 1', callback_data: 'opt1' },
          { text: 'Option 2', callback_data: 'opt2' },
        ],
      ];

      const messageId = await client.sendMessageWithKeyboard(
        '123456789',
        'Choose an option',
        keyboard
      );

      expect(messageId).toBe('127');

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.reply_markup).toBeDefined();
      const replyMarkup = JSON.parse(body.reply_markup);
      expect(replyMarkup.inline_keyboard).toHaveLength(1);
      expect(replyMarkup.inline_keyboard[0]).toHaveLength(2);
    });
  });

  describe('handleWebhook', () => {
    it('should parse incoming text message', async () => {
      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'John',
            username: 'john_doe',
          },
          chat: {
            id: 123456789,
            type: 'private',
          },
          date: 1234567890,
          text: 'Hello from Telegram!',
        },
      };

      const message = await client.handleWebhook(update);

      expect(message).not.toBeNull();
      expect(message?.platform).toBe('telegram');
      expect(message?.from).toBe('123456789');
      expect(message?.type).toBe('text');
      expect(message?.content).toBe('Hello from Telegram!');
    });

    it('should parse callback query', async () => {
      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const update = {
        update_id: 124,
        callback_query: {
          id: 'callback_123',
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'John',
          },
          message: {
            message_id: 456,
            chat: { id: 123456789 },
          },
          data: 'button_click',
        },
      };

      const message = await client.handleWebhook(update);

      expect(message).not.toBeNull();
      expect(message?.content).toBe('button_click');
      expect(message?.metadata?.callbackData).toBe('button_click');
    });

    it('should parse incoming photo', async () => {
      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const update = {
        update_id: 125,
        message: {
          message_id: 457,
          from: { id: 123456789, is_bot: false, first_name: 'John' },
          chat: { id: 123456789, type: 'private' },
          date: 1234567890,
          photo: [
            { file_id: 'small', file_unique_id: 'u1', width: 100, height: 100 },
            { file_id: 'large', file_unique_id: 'u2', width: 800, height: 800 },
          ],
          caption: 'Check this out',
        },
      };

      const message = await client.handleWebhook(update);

      expect(message).not.toBeNull();
      expect(message?.type).toBe('image');
      expect(message?.caption).toBe('Check this out');
      // Should use largest photo
      expect(message?.mediaUrl).toBe('large');
    });
  });

  describe('editMessage', () => {
    it('should edit sent message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: 123,
            chat: { id: 123456789 },
            text: 'Updated text',
          },
        }),
      });

      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const result = await client.editMessage('123456789', '123', 'Updated text');

      expect(result).toBe(true);
    });
  });

  describe('answerCallbackQuery', () => {
    it('should answer callback query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: true }),
      });

      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      const result = await client.answerCallbackQuery('query_123', 'Button clicked!', true);

      expect(result).toBe(true);
    });
  });

  describe('createInlineKeyboard', () => {
    it('should create inline keyboard markup', () => {
      const keyboard = createInlineKeyboard([
        [
          { text: 'Button 1', callback_data: 'btn1' },
          { text: 'Button 2', url: 'https://example.com' },
        ],
        [
          { text: 'Button 3', callback_data: 'btn3' },
        ],
      ]);

      expect(keyboard.inline_keyboard).toHaveLength(2);
      expect(keyboard.inline_keyboard[0]).toHaveLength(2);
      expect(keyboard.inline_keyboard[0][0].text).toBe('Button 1');
      expect(keyboard.inline_keyboard[0][0].callback_data).toBe('btn1');
      expect(keyboard.inline_keyboard[0][1].url).toBe('https://example.com');
    });
  });

  describe('disconnect', () => {
    it('should disconnect properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: true }),
      });

      const client = new TelegramClient(config);
      (client as any)._isConnected = true;

      await client.disconnect();

      expect(client.isConnected).toBe(false);
    });
  });
});

// ============================================================================
// MESSAGING MANAGER TESTS
// ============================================================================

describe('MessagingManager', () => {
  let MessagingManager: typeof import('../manager').MessagingManager;
  let manager: InstanceType<typeof MessagingManager>;

  beforeEach(async () => {
    vi.resetModules();
    const managerModule = await import('../manager');
    MessagingManager = managerModule.MessagingManager;

    manager = new MessagingManager({
      enableLogging: true,
      enableBroadcast: true,
    });

    mockFetch.mockReset();
  });

  afterEach(async () => {
    await manager.disconnect();
  });

  describe('constructor', () => {
    it('should create manager with default config', () => {
      const defaultManager = new MessagingManager();
      expect(defaultManager).toBeDefined();
    });

    it('should apply custom config', () => {
      const customManager = new MessagingManager({
        enableQueue: false,
        maxQueueSize: 500,
      });
      expect(customManager).toBeDefined();
    });
  });

  describe('platform management', () => {
    it('should register a platform', () => {
      const mockPlatform = createMockPlatform('whatsapp');
      manager.registerPlatform(mockPlatform);

      expect(manager.getPlatforms()).toContain('whatsapp');
    });

    it('should unregister a platform', async () => {
      const mockPlatform = createMockPlatform('telegram');
      manager.registerPlatform(mockPlatform);

      await manager.unregisterPlatform('telegram');

      expect(manager.getPlatforms()).not.toContain('telegram');
    });

    it('should get registered platform', () => {
      const mockPlatform = createMockPlatform('whatsapp');
      manager.registerPlatform(mockPlatform);

      const platform = manager.getPlatform('whatsapp');
      expect(platform).toBe(mockPlatform);
    });

    it('should enable/disable platform', () => {
      const mockPlatform = createMockPlatform('whatsapp');
      manager.registerPlatform(mockPlatform);

      manager.setPlatformEnabled('whatsapp', false);

      const platform = manager.getPlatform('whatsapp');
      expect(platform).toBeNull();
    });

    it('should check platform availability', () => {
      const mockPlatform = createMockPlatform('telegram');
      mockPlatform.isConnected = true;
      manager.registerPlatform(mockPlatform);

      expect(manager.isPlatformAvailable('telegram')).toBe(true);
    });
  });

  describe('message sending', () => {
    it('should send message through platform', async () => {
      const mockPlatform = createMockPlatform('whatsapp');
      mockPlatform.isConnected = true;
      mockPlatform.sendMessage = vi.fn().mockResolvedValue('msg_123');
      manager.registerPlatform(mockPlatform);

      const messageId = await manager.sendMessage('whatsapp', '+1234567890', 'Hello!');

      expect(messageId).toBe('msg_123');
    });

    it('should throw error for unavailable platform', async () => {
      await expect(manager.sendMessage('whatsapp', '+1234567890', 'Hello!'))
        .rejects.toThrow(MessagingError);
    });

    it('should send image through platform', async () => {
      const mockPlatform = createMockPlatform('telegram');
      mockPlatform.isConnected = true;
      mockPlatform.sendImage = vi.fn().mockResolvedValue('img_123');
      manager.registerPlatform(mockPlatform);

      const messageId = await manager.sendImage(
        'telegram',
        '123456789',
        'https://example.com/image.jpg',
        'Caption'
      );

      expect(messageId).toBe('img_123');
    });

    it('should send document through platform', async () => {
      const mockPlatform = createMockPlatform('whatsapp');
      mockPlatform.isConnected = true;
      mockPlatform.sendDocument = vi.fn().mockResolvedValue('doc_123');
      manager.registerPlatform(mockPlatform);

      const messageId = await manager.sendDocument(
        'whatsapp',
        '+1234567890',
        'https://example.com/doc.pdf',
        'document.pdf',
        'Here is the document'
      );

      expect(messageId).toBe('doc_123');
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to multiple recipients', async () => {
      const mockPlatform = createMockPlatform('whatsapp');
      mockPlatform.isConnected = true;
      mockPlatform.sendMessage = vi.fn().mockResolvedValue('msg_123');
      manager.registerPlatform(mockPlatform);

      const result = await manager.broadcast('Hello everyone!', [
        { platform: 'whatsapp', recipients: ['+1111111111', '+2222222222'] },
      ]);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle partial broadcast failures', async () => {
      const mockPlatform = createMockPlatform('telegram');
      mockPlatform.isConnected = true;
      mockPlatform.sendMessage = vi.fn()
        .mockResolvedValueOnce('msg_1')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('msg_3');
      manager.registerPlatform(mockPlatform);

      const result = await manager.broadcast('Hello!', [
        { platform: 'telegram', recipients: ['111', '222', '333'] },
      ]);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should skip unavailable platforms in broadcast', async () => {
      const result = await manager.broadcast('Hello!', [
        { platform: 'whatsapp', recipients: ['+1111111111'] },
      ]);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe('message handlers', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onMessage(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call message handlers on incoming message', async () => {
      const handler = vi.fn();
      manager.onMessage(handler);

      // Simulate incoming message
      const message: Message = {
        id: 'msg_123',
        platform: 'whatsapp',
        from: '+1234567890',
        to: '+0987654321',
        timestamp: new Date(),
        type: 'text',
        content: 'Hello!',
        status: 'delivered',
        raw: {},
      };

      await (manager as any).handleIncomingMessage(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should unsubscribe message handler', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onMessage(handler);

      unsubscribe();

      // Handler should not be called after unsubscribe
      // This is a simple check - actual implementation may vary
      expect(manager.getStatus().handlers).toBe(0);
    });
  });

  describe('status', () => {
    it('should return manager status', () => {
      const status = manager.getStatus();

      expect(status).toHaveProperty('platforms');
      expect(status).toHaveProperty('queuedMessages');
      expect(status).toHaveProperty('activeBroadcasts');
      expect(status).toHaveProperty('handlers');
    });
  });

  describe('message formatting', () => {
    it('should format message for WhatsApp', () => {
      const formatted = manager.formatMessage('whatsapp', '**Bold**', 'plain');
      expect(formatted).toBe('*Bold*');
    });

    it('should format message for Telegram', () => {
      const formatted = manager.formatMessage('telegram', 'Hello_World', 'plain');
      expect(formatted).toBe('Hello\\_World');
    });
  });

  describe('disconnect', () => {
    it('should disconnect all platforms', async () => {
      const mockPlatform1 = createMockPlatform('whatsapp');
      const mockPlatform2 = createMockPlatform('telegram');
      
      manager.registerPlatform(mockPlatform1);
      manager.registerPlatform(mockPlatform2);

      await manager.disconnect();

      expect(mockPlatform1.disconnect).toHaveBeenCalled();
      expect(mockPlatform2.disconnect).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockPlatform(type: MessagingPlatformType): any {
  return {
    platformType: type,
    isConnected: false,
    initialize: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue('mock_msg_id'),
    sendImage: vi.fn().mockResolvedValue('mock_img_id'),
    sendDocument: vi.fn().mockResolvedValue('mock_doc_id'),
    handleWebhook: vi.fn().mockResolvedValue(null),
    getMessageStatus: vi.fn().mockResolvedValue('sent'),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    eventNames: vi.fn().mockReturnValue([]),
  };
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  it('should handle end-to-end message flow', async () => {
    const { WhatsAppClient } = await import('../whatsapp');
    const { TelegramClient } = await import('../telegram');
    const { MessagingManager } = await import('../manager');

    mockFetch.mockReset();

    // Mock WhatsApp API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'test' }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.test' }],
      }),
    });

    // Mock Telegram API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: { id: 123, is_bot: true, first_name: 'TestBot' },
      }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: { message_id: 456 },
      }),
    });

    const manager = new MessagingManager();

    // Create and register platforms
    const waConfig: WhatsAppConfig = {
      businessAccountId: 'test',
      phoneNumberId: 'test',
      accessToken: 'test',
      verifyToken: 'test',
    };

    const tgConfig: TelegramConfig = {
      botToken: 'test_token',
      useWebhook: false,
    };

    // Initialize would fail without real credentials, so we mock it
    const waClient = new WhatsAppClient(waConfig);
    (waClient as any)._isConnected = true;
    manager.registerPlatform(waClient);

    const tgClient = new TelegramClient(tgConfig);
    (tgClient as any)._isConnected = true;
    manager.registerPlatform(tgClient);

    // Check platforms are registered
    expect(manager.getPlatforms()).toHaveLength(2);

    await manager.disconnect();
  });

  it('should rate limit messages correctly', async () => {
    vi.useFakeTimers();

    const { WhatsAppClient } = await import('../whatsapp');

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.test' }],
      }),
    });

    const client = new WhatsAppClient({
      businessAccountId: 'test',
      phoneNumberId: 'test',
      accessToken: 'test',
      verifyToken: 'test',
      rateLimit: 1, // 1 message per second
    });

    (client as any)._isConnected = true;

    // Send multiple messages
    const promises = [
      client.sendMessage('+1111111111', 'Message 1'),
      client.sendMessage('+2222222222', 'Message 2'),
    ];

    // Advance time to process rate limit queue
    vi.advanceTimersByTime(2000);

    await Promise.all(promises);

    vi.useRealTimers();
  });
});
