/**
 * NEXUS Messaging Platform Types
 * 
 * Shared types and interfaces for WhatsApp and Telegram integrations.
 */

// ============================================================================
// CORE MESSAGE TYPES
// ============================================================================

/**
 * Supported messaging platforms
 */
export type MessagingPlatformType = 'whatsapp' | 'telegram' | 'web';

/**
 * Types of message content
 */
export type MessageType = 'text' | 'image' | 'audio' | 'document' | 'video' | 'location' | 'contact';

/**
 * Message status for tracking delivery
 */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Standard message format across all platforms
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Platform that sent/received the message */
  platform: MessagingPlatformType;
  /** Sender identifier (phone number, user ID, etc.) */
  from: string;
  /** Recipient identifier */
  to: string;
  /** Message timestamp */
  timestamp: Date;
  /** Type of message content */
  type: MessageType;
  /** Message content (text, URL, etc.) */
  content: string;
  /** Caption for media messages */
  caption?: string;
  /** Media URL for image/audio/document messages */
  mediaUrl?: string;
  /** Current delivery status */
  status: MessageStatus;
  /** Raw platform-specific data */
  raw: unknown;
  /** Optional reply-to message ID */
  replyTo?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Formatted message with platform-specific formatting
 */
export interface FormattedMessage {
  /** Plain text content */
  text: string;
  /** Markdown formatted content */
  markdown?: string;
  /** HTML formatted content */
  html?: string;
  /** Whether message contains code blocks */
  hasCode?: boolean;
}

// ============================================================================
// PLATFORM INTERFACE
// ============================================================================

/**
 * Interface that all messaging platforms must implement
 */
export interface MessagingPlatform {
  /** Platform identifier */
  readonly platformType: MessagingPlatformType;
  /** Whether the platform is currently connected */
  readonly isConnected: boolean;
  
  /**
   * Send a text message
   * @param to Recipient identifier
   * @param text Message text
   * @param options Optional send options
   * @returns Message ID if successful
   */
  sendMessage(to: string, text: string, options?: SendOptions): Promise<string>;
  
  /**
   * Send an image message
   * @param to Recipient identifier
   * @param imageUrl Image URL or base64 data
   * @param caption Optional caption
   * @returns Message ID if successful
   */
  sendImage(to: string, imageUrl: string, caption?: string): Promise<string>;
  
  /**
   * Send a document
   * @param to Recipient identifier
   * @param documentUrl Document URL or base64 data
   * @param filename Document filename
   * @param caption Optional caption
   * @returns Message ID if successful
   */
  sendDocument(to: string, documentUrl: string, filename: string, caption?: string): Promise<string>;
  
  /**
   * Handle incoming webhook payload
   * @param body Raw webhook body
   * @returns Parsed message or null if not a message
   */
  handleWebhook(body: unknown): Promise<Message | null>;
  
  /**
   * Get message status
   * @param messageId Message ID to check
   * @returns Current message status
   */
  getMessageStatus(messageId: string): Promise<MessageStatus>;
  
  /**
   * Mark messages as read
   * @param messageIds Message IDs to mark as read
   */
  markAsRead(messageIds: string[]): Promise<void>;
  
  /**
   * Initialize the platform connection
   */
  initialize(): Promise<void>;
  
  /**
   * Disconnect from the platform
   */
  disconnect(): Promise<void>;
}

/**
 * Options for sending messages
 */
export interface SendOptions {
  /** Parse mode for formatting */
  parseMode?: 'none' | 'markdown' | 'html';
  /** Reply to message ID */
  replyTo?: string;
  /** Disable notification */
  silent?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// WHATSAPP SPECIFIC TYPES
// ============================================================================

/**
 * WhatsApp Business API configuration
 */
export interface WhatsAppConfig {
  /** WhatsApp Business Account ID */
  businessAccountId: string;
  /** Phone Number ID from Meta Business Suite */
  phoneNumberId: string;
  /** Permanent access token */
  accessToken: string;
  /** Webhook verification token */
  verifyToken: string;
  /** Webhook secret for signature verification */
  appSecret?: string;
  /** API version (default: v18.0) */
  apiVersion?: string;
  /** Enable message status tracking */
  trackStatus?: boolean;
  /** Rate limit: messages per second */
  rateLimit?: number;
}

/**
 * WhatsApp webhook entry
 */
export interface WhatsAppWebhookEntry {
  id: string;
  changes: WhatsAppWebhookChange[];
}

/**
 * WhatsApp webhook change
 */
export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: string;
}

/**
 * WhatsApp webhook value
 */
export interface WhatsAppWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessageData[];
  statuses?: WhatsAppStatusData[];
}

/**
 * WhatsApp contact info
 */
export interface WhatsAppContact {
  profile: {
    name?: string;
  };
  wa_id: string;
}

/**
 * WhatsApp message data from webhook
 */
export interface WhatsAppMessageData {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'document' | 'video' | 'location' | 'contacts';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type?: string;
    sha256?: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type?: string;
    sha256?: string;
  };
  document?: {
    id: string;
    mime_type?: string;
    sha256?: string;
    filename?: string;
    caption?: string;
  };
  video?: {
    id: string;
    mime_type?: string;
    sha256?: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: WhatsAppContactData[];
  context?: {
    id: string;
    forwarded?: boolean;
  };
}

/**
 * WhatsApp contact card data
 */
export interface WhatsAppContactData {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
  };
  phones?: {
    phone?: string;
    type?: string;
    wa_id?: string;
  }[];
  emails?: {
    email?: string;
    type?: string;
  }[];
}

/**
 * WhatsApp status data from webhook
 */
export interface WhatsAppStatusData {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: WhatsAppError[];
}

/**
 * WhatsApp error
 */
export interface WhatsAppError {
  code: number;
  title: string;
  message?: string;
  details?: string;
}

/**
 * WhatsApp API response
 */
export interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: {
    input: string;
    wa_id: string;
  }[];
  messages: {
    id: string;
  }[];
}

// ============================================================================
// TELEGRAM SPECIFIC TYPES
// ============================================================================

/**
 * Telegram Bot API configuration
 */
export interface TelegramConfig {
  /** Bot token from BotFather */
  botToken: string;
  /** Use webhook mode (default: polling) */
  useWebhook?: boolean;
  /** Webhook URL (required if useWebhook is true) */
  webhookUrl?: string;
  /** Webhook secret token */
  webhookSecret?: string;
  /** Maximum connections for webhook */
  maxConnections?: number;
  /** Allowed updates */
  allowedUpdates?: string[];
  /** Polling timeout in seconds */
  pollingTimeout?: number;
  /** Rate limit: messages per second */
  rateLimit?: number;
}

/**
 * Telegram update object
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  inline_query?: TelegramInlineQuery;
  chosen_inline_result?: TelegramChosenInlineResult;
  callback_query?: TelegramCallbackQuery;
  shipping_query?: unknown;
  pre_checkout_query?: unknown;
  poll?: unknown;
  poll_answer?: unknown;
}

/**
 * Telegram message
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_date?: number;
  reply_to_message?: TelegramMessage;
  edit_date?: number;
  text?: string;
  entities?: TelegramMessageEntity[];
  caption_entities?: TelegramMessageEntity[];
  audio?: TelegramAudio;
  document?: TelegramDocument;
  animation?: unknown;
  game?: unknown;
  photo?: TelegramPhotoSize[];
  sticker?: unknown;
  video?: TelegramVideo;
  voice?: TelegramVoice;
  video_note?: unknown;
  caption?: string;
  contact?: TelegramContact;
  location?: TelegramLocation;
  venue?: unknown;
  left_chat_member?: TelegramUser;
  new_chat_members?: TelegramUser[];
  new_chat_title?: string;
  new_chat_photo?: TelegramPhotoSize[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
}

/**
 * Telegram user
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

/**
 * Telegram chat
 */
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram message entity
 */
export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

/**
 * Telegram photo size
 */
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * Telegram audio
 */
export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram document
 */
export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram video
 */
export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram voice
 */
export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram contact
 */
export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
}

/**
 * Telegram location
 */
export interface TelegramLocation {
  latitude: number;
  longitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

/**
 * Telegram inline query
 */
export interface TelegramInlineQuery {
  id: string;
  from: TelegramUser;
  query: string;
  offset: string;
  chat_type?: string;
  location?: TelegramLocation;
}

/**
 * Telegram chosen inline result
 */
export interface TelegramChosenInlineResult {
  result_id: string;
  from: TelegramUser;
  query: string;
  location?: TelegramLocation;
  inline_message_id?: string;
}

/**
 * Telegram callback query
 */
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

/**
 * Telegram inline keyboard button
 */
export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  callback_game?: unknown;
  pay?: boolean;
}

/**
 * Telegram inline keyboard markup
 */
export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

/**
 * Telegram send message options
 */
export interface TelegramSendOptions extends SendOptions {
  /** Inline keyboard */
  reply_markup?: TelegramInlineKeyboardMarkup;
  /** Disable link previews */
  disable_web_page_preview?: boolean;
}

/**
 * Telegram API response
 */
export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

// ============================================================================
// RATE LIMITING & QUEUING
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Enable queue for rate-limited requests */
  enableQueue: boolean;
  /** Maximum queue size */
  maxQueueSize?: number;
}

/**
 * Queued message
 */
export interface QueuedMessage {
  /** Queue item ID */
  id: string;
  /** Platform type */
  platform: MessagingPlatformType;
  /** Recipient */
  to: string;
  /** Message content */
  content: string | { type: 'image' | 'document'; url: string; caption?: string; filename?: string };
  /** Send options */
  options?: SendOptions;
  /** Queue timestamp */
  queuedAt: Date;
  /** Retry count */
  retries: number;
  /** Max retries */
  maxRetries: number;
  /** Priority (higher = more urgent) */
  priority: number;
  /** Resolve promise */
  resolve: (messageId: string) => void;
  /** Reject promise */
  reject: (error: Error) => void;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Webhook path */
  path: string;
  /** Webhook port */
  port?: number;
  /** Verify token (WhatsApp) */
  verifyToken?: string;
  /** Secret for signature verification */
  secret?: string;
  /** Allowed IPs */
  allowedIps?: string[];
}

/**
 * Webhook verification result
 */
export interface WebhookVerification {
  verified: boolean;
  platform?: MessagingPlatformType;
  challenge?: string;
  error?: string;
}

// ============================================================================
// BROADCAST TYPES
// ============================================================================

/**
 * Broadcast target
 */
export interface BroadcastTarget {
  platform: MessagingPlatformType;
  recipients: string[];
}

/**
 * Broadcast message
 */
export interface BroadcastMessage {
  /** Broadcast ID */
  id: string;
  /** Message content */
  content: string;
  /** Targets per platform */
  targets: BroadcastTarget[];
  /** Created at */
  createdAt: Date;
  /** Status per recipient */
  status: Map<string, MessageStatus>;
}

/**
 * Broadcast result
 */
export interface BroadcastResult {
  /** Broadcast ID */
  broadcastId: string;
  /** Total recipients */
  totalRecipients: number;
  /** Successfully sent */
  sent: number;
  /** Failed */
  failed: number;
  /** Results per recipient */
  results: Map<string, { success: boolean; messageId?: string; error?: string }>;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Messaging event types
 */
export type MessagingEventType = 
  | 'message:received'
  | 'message:sent'
  | 'message:delivered'
  | 'message:read'
  | 'message:failed'
  | 'webhook:verified'
  | 'platform:connected'
  | 'platform:disconnected'
  | 'rate:limited'
  | 'queue:drained';

/**
 * Messaging event
 */
export interface MessagingEvent {
  type: MessagingEventType;
  timestamp: Date;
  platform: MessagingPlatformType;
  data: Record<string, unknown>;
}

/**
 * Event handler type
 */
export type MessagingEventHandler = (event: MessagingEvent) => void | Promise<void>;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Messaging error codes
 */
export type MessagingErrorCode = 
  | 'PLATFORM_NOT_CONNECTED'
  | 'INVALID_CONFIGURATION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MESSAGE_TOO_LONG'
  | 'INVALID_RECIPIENT'
  | 'MEDIA_UPLOAD_FAILED'
  | 'WEBHOOK_VERIFICATION_FAILED'
  | 'API_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

/**
 * Messaging error
 */
export class MessagingError extends Error {
  code: MessagingErrorCode;
  platform?: MessagingPlatformType;
  details?: Record<string, unknown>;

  constructor(
    code: MessagingErrorCode,
    message: string,
    platform?: MessagingPlatformType,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.platform = platform;
    this.details = details;
    this.name = 'MessagingError';
  }
}
