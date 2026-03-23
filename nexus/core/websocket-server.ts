/**
 * NEXUS WebSocket Server
 * Real-time communication server for agent events and messages
 * 
 * Features:
 * - Client connection management
 * - Agent subscription system
 * - Message broadcasting
 * - Event streaming (status updates, tool calls, memory changes)
 * - Ping/pong heartbeat mechanism
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer as WSServer, RawData } from 'ws';
import { createServer, IncomingMessage, Server as HTTPServer } from 'http';
import { NexusEventType, NexusEvent, AgentStatus } from './types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type NexusWSMessageType = 
  | 'status'      // Agent status updates
  | 'chat'        // Chat messages
  | 'tool_call'   // Tool execution events
  | 'memory'      // Memory changes
  | 'skill'       // Skill events
  | 'error'       // Error events
  | 'heartbeat'   // Ping/pong heartbeat
  | 'subscribe'   // Subscribe to agent events
  | 'unsubscribe' // Unsubscribe from agent events
  | 'history';    // Request message history

export interface NexusWSMessage {
  type: NexusWSMessageType;
  payload: unknown;
  timestamp: Date;
  agentId: string;
  messageId?: string;
}

export interface WSClient {
  id: string;
  socket: WebSocket;
  subscribedAgents: Set<string>;
  subscribedEvents: Set<NexusEventType | '*'>;
  lastPing: Date;
  lastPong: Date;
  isAlive: boolean;
  metadata: Record<string, unknown>;
}

export interface NexusWSServerConfig {
  port?: number;
  host?: string;
  pingInterval?: number;    // ms between pings
  pingTimeout?: number;     // ms before considering client dead
  maxClients?: number;
  messageQueueSize?: number;
  enableHistory?: boolean;
  historyLimit?: number;
}

export interface WSClientInfo {
  id: string;
  subscribedAgents: string[];
  subscribedEvents: string[];
  isAlive: boolean;
  lastPing: string;
  lastPong: string;
}

export interface BroadcastOptions {
  excludeClientId?: string;
  requireSubscription?: boolean;
  eventType?: NexusEventType;
}

// ============================================================================
// WEBSOCKET SERVER CLASS
// ============================================================================

export class NexusWebSocketServer extends EventEmitter {
  private wss: WSServer | null = null;
  private httpServer: HTTPServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private agentClients: Map<string, Set<string>> = new Map(); // agentId -> clientIds
  private messageHistory: Map<string, NexusWSMessage[]> = new Map(); // agentId -> messages
  private pingInterval: NodeJS.Timeout | null = null;
  private config: Required<NexusWSServerConfig>;
  private isRunning: boolean = false;

  constructor(config: NexusWSServerConfig = {}) {
    super();
    
    this.config = {
      port: config.port ?? 3002,
      host: config.host ?? 'localhost',
      pingInterval: config.pingInterval ?? 30000,
      pingTimeout: config.pingTimeout ?? 60000,
      maxClients: config.maxClients ?? 100,
      messageQueueSize: config.messageQueueSize ?? 100,
      enableHistory: config.enableHistory ?? true,
      historyLimit: config.historyLimit ?? 50,
    };
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('WebSocket server is already running');
    }

    return new Promise((resolve, reject) => {
      // Create HTTP server
      this.httpServer = createServer();
      
      // Create WebSocket server
      this.wss = new WSServer({
        server: this.httpServer,
        clientTracking: false,
        perMessageDeflate: false, // Disable compression for lower latency
      });

      // Setup connection handler
      this.wss.on('connection', (socket, request) => {
        this.handleConnection(socket, request);
      });

      this.wss.on('error', (error) => {
        this.emit('server:error', { error });
        reject(error);
      });

      // Start HTTP server
      this.httpServer.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        this.startHeartbeat();
        this.emit('server:started', { 
          port: this.config.port, 
          host: this.config.host 
        });
        resolve();
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    // Check max clients
    if (this.clients.size >= this.config.maxClients) {
      socket.close(1013, 'Server at maximum capacity');
      return;
    }

    const clientId = this.generateClientId();
    const client: WSClient = {
      id: clientId,
      socket,
      subscribedAgents: new Set(),
      subscribedEvents: new Set(),
      lastPing: new Date(),
      lastPong: new Date(),
      isAlive: true,
      metadata: {
        ip: this.getClientIP(request),
        userAgent: request.headers['user-agent'],
      },
    };

    this.clients.set(clientId, client);

    // Setup event handlers
    socket.on('message', (data: RawData) => {
      this.handleMessage(clientId, data);
    });

    socket.on('pong', () => {
      this.handlePong(clientId);
    });

    socket.on('close', (code, reason) => {
      this.handleDisconnect(clientId, code, reason.toString());
    });

    socket.on('error', (error) => {
      this.handleError(clientId, error);
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'status',
      payload: { 
        message: 'Connected to NEXUS WebSocket Server',
        clientId,
        serverTime: new Date().toISOString(),
      },
      timestamp: new Date(),
      agentId: 'system',
    });

    this.emit('client:connected', { clientId, metadata: client.metadata });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(clientId: string, data: RawData): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = this.parseMessage(data);
      if (!message) {
        this.sendError(clientId, 'Invalid message format');
        return;
      }

      this.emit('message:received', { clientId, message });

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message);
          break;
        case 'heartbeat':
          this.handleHeartbeatMessage(clientId, message);
          break;
        case 'history':
          this.handleHistoryRequest(clientId, message);
          break;
        case 'chat':
          // Forward chat messages to agent subscribers
          this.broadcast(message.agentId, message, { excludeClientId: clientId });
          this.emit('chat:message', { clientId, message });
          break;
        default:
          // Emit custom message event
          this.emit('message:custom', { clientId, message });
      }
    } catch (error) {
      this.sendError(clientId, `Message processing error: ${(error as Error).message}`);
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(clientId: string, message: NexusWSMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const payload = message.payload as {
      agentId?: string;
      eventTypes?: (NexusEventType | '*')[];
    };

    // Subscribe to specific agent
    if (payload.agentId) {
      client.subscribedAgents.add(payload.agentId);
      
      // Update agent -> clients mapping
      if (!this.agentClients.has(payload.agentId)) {
        this.agentClients.set(payload.agentId, new Set());
      }
      this.agentClients.get(payload.agentId)!.add(clientId);

      // Send confirmation
      this.sendToClient(clientId, {
        type: 'status',
        payload: { 
          message: `Subscribed to agent: ${payload.agentId}`,
          agentId: payload.agentId,
        },
        timestamp: new Date(),
        agentId: 'system',
      });

      this.emit('agent:subscribed', { clientId, agentId: payload.agentId });
    }

    // Subscribe to specific event types
    if (payload.eventTypes && Array.isArray(payload.eventTypes)) {
      payload.eventTypes.forEach(eventType => {
        client.subscribedEvents.add(eventType);
      });

      this.sendToClient(clientId, {
        type: 'status',
        payload: { 
          message: `Subscribed to events: ${payload.eventTypes.join(', ')}`,
          eventTypes: payload.eventTypes,
        },
        timestamp: new Date(),
        agentId: 'system',
      });
    }
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribe(clientId: string, message: NexusWSMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const payload = message.payload as {
      agentId?: string;
      eventTypes?: (NexusEventType | '*')[];
    };

    if (payload.agentId) {
      client.subscribedAgents.delete(payload.agentId);
      
      const agentClients = this.agentClients.get(payload.agentId);
      if (agentClients) {
        agentClients.delete(clientId);
        if (agentClients.size === 0) {
          this.agentClients.delete(payload.agentId);
        }
      }

      this.emit('agent:unsubscribed', { clientId, agentId: payload.agentId });
    }

    if (payload.eventTypes && Array.isArray(payload.eventTypes)) {
      payload.eventTypes.forEach(eventType => {
        client.subscribedEvents.delete(eventType);
      });
    }
  }

  /**
   * Handle heartbeat message from client
   */
  private handleHeartbeatMessage(clientId: string, message: NexusWSMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastPong = new Date();
    client.isAlive = true;

    // Send heartbeat response
    this.sendToClient(clientId, {
      type: 'heartbeat',
      payload: { 
        serverTime: new Date().toISOString(),
        latency: message.timestamp ? Date.now() - new Date(message.timestamp).getTime() : 0,
      },
      timestamp: new Date(),
      agentId: 'system',
    });
  }

  /**
   * Handle history request
   */
  private handleHistoryRequest(clientId: string, message: NexusWSMessage): void {
    if (!this.config.enableHistory) {
      this.sendError(clientId, 'History is not enabled');
      return;
    }

    const payload = message.payload as { agentId?: string };
    const agentId = payload.agentId;

    if (!agentId) {
      this.sendError(clientId, 'Agent ID required for history request');
      return;
    }

    const history = this.messageHistory.get(agentId) || [];
    
    this.sendToClient(clientId, {
      type: 'history',
      payload: { agentId, messages: history },
      timestamp: new Date(),
      agentId: 'system',
    });
  }

  /**
   * Handle pong response
   */
  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPong = new Date();
      client.isAlive = true;
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Clean up agent subscriptions
    client.subscribedAgents.forEach(agentId => {
      const agentClients = this.agentClients.get(agentId);
      if (agentClients) {
        agentClients.delete(clientId);
        if (agentClients.size === 0) {
          this.agentClients.delete(agentId);
        }
      }
    });

    this.clients.delete(clientId);
    this.emit('client:disconnected', { clientId, code, reason });
  }

  /**
   * Handle client error
   */
  private handleError(clientId: string, error: Error): void {
    this.emit('client:error', { clientId, error });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          // Client didn't respond to last ping, terminate connection
          client.socket.terminate();
          this.handleDisconnect(clientId, 1001, 'Ping timeout');
          return;
        }

        // Mark as not alive until we get a pong
        client.isAlive = false;
        client.lastPing = new Date();
        
        // Send ping
        client.socket.ping();
      });
    }, this.config.pingInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Broadcast message to all clients subscribed to an agent
   */
  broadcast(agentId: string, message: NexusWSMessage, options: BroadcastOptions = {}): void {
    const clientIds = this.agentClients.get(agentId);
    if (!clientIds) return;

    // Store in history
    if (this.config.enableHistory) {
      this.addToHistory(agentId, message);
    }

    clientIds.forEach(clientId => {
      if (options.excludeClientId === clientId) return;

      const client = this.clients.get(clientId);
      if (!client || !client.isAlive) return;

      // Check event subscription
      if (options.eventType && 
          client.subscribedEvents.size > 0 && 
          !client.subscribedEvents.has('*') &&
          !client.subscribedEvents.has(options.eventType)) {
        return;
      }

      this.sendToClient(clientId, message);
    });

    this.emit('message:broadcast', { agentId, message, clientCount: clientIds.size });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(message: NexusWSMessage): void {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });

    this.emit('message:broadcast:all', { message, clientCount: this.clients.size });
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: NexusWSMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const serialized = JSON.stringify({
        ...message,
        timestamp: message.timestamp instanceof Date 
          ? message.timestamp.toISOString() 
          : message.timestamp,
        messageId: message.messageId || this.generateMessageId(),
      });

      client.socket.send(serialized);
      return true;
    } catch (error) {
      this.emit('send:error', { clientId, error });
      return false;
    }
  }

  /**
   * Send error message to client
   */
  sendError(clientId: string, errorMessage: string, details?: unknown): void {
    this.sendToClient(clientId, {
      type: 'error',
      payload: { message: errorMessage, details },
      timestamp: new Date(),
      agentId: 'system',
    });
  }

  /**
   * Get list of clients subscribed to an agent
   */
  getClients(agentId: string): WSClientInfo[] {
    const clientIds = this.agentClients.get(agentId);
    if (!clientIds) return [];

    const clients: WSClientInfo[] = [];
    clientIds.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client) {
        clients.push(this.getClientInfo(client));
      }
    });

    return clients;
  }

  /**
   * Get all connected clients
   */
  getAllClients(): WSClientInfo[] {
    const clients: WSClientInfo[] = [];
    this.clients.forEach(client => {
      clients.push(this.getClientInfo(client));
    });
    return clients;
  }

  /**
   * Get client info
   */
  private getClientInfo(client: WSClient): WSClientInfo {
    return {
      id: client.id,
      subscribedAgents: Array.from(client.subscribedAgents),
      subscribedEvents: Array.from(client.subscribedEvents),
      isAlive: client.isAlive,
      lastPing: client.lastPing.toISOString(),
      lastPong: client.lastPong.toISOString(),
    };
  }

  /**
   * Get server statistics
   */
  getStats(): {
    isRunning: boolean;
    totalClients: number;
    totalAgents: number;
    port: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      totalClients: this.clients.size,
      totalAgents: this.agentClients.size,
      port: this.config.port,
      uptime: this.isRunning ? Date.now() - (this.httpServer?.listening ? Date.now() : 0) : 0,
    };
  }

  /**
   * Emit event to all subscribers
   */
  emitEvent(agentId: string, event: NexusEvent): void {
    const message: NexusWSMessage = {
      type: this.eventTypeToMessageType(event.type),
      payload: event.data,
      timestamp: event.timestamp,
      agentId,
    };

    this.broadcast(agentId, message, { eventType: event.type });
  }

  /**
   * Close the WebSocket server
   */
  async close(): Promise<void> {
    if (!this.isRunning) return;

    this.stopHeartbeat();

    // Close all client connections
    this.clients.forEach((client) => {
      client.socket.close(1001, 'Server shutting down');
    });

    this.clients.clear();
    this.agentClients.clear();
    this.messageHistory.clear();

    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          if (this.httpServer) {
            this.httpServer.close(() => {
              this.isRunning = false;
              this.emit('server:stopped', {});
              resolve();
            });
          } else {
            this.isRunning = false;
            this.emit('server:stopped', {});
            resolve();
          }
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIP(request: IncomingMessage): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return request.socket.remoteAddress || 'unknown';
  }

  private parseMessage(data: RawData): NexusWSMessage | null {
    try {
      const str = data.toString();
      const parsed = JSON.parse(str);
      
      if (!parsed.type || !parsed.payload) {
        return null;
      }

      return {
        type: parsed.type,
        payload: parsed.payload,
        timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
        agentId: parsed.agentId || 'unknown',
        messageId: parsed.messageId,
      };
    } catch {
      return null;
    }
  }

  private addToHistory(agentId: string, message: NexusWSMessage): void {
    if (!this.messageHistory.has(agentId)) {
      this.messageHistory.set(agentId, []);
    }

    const history = this.messageHistory.get(agentId)!;
    history.push({
      ...message,
      messageId: message.messageId || this.generateMessageId(),
    });

    // Trim history to limit
    if (history.length > this.config.historyLimit) {
      history.shift();
    }
  }

  private eventTypeToMessageType(eventType: NexusEventType): NexusWSMessageType {
    if (eventType.startsWith('agent:') || eventType.startsWith('scheduler:') || eventType.startsWith('orchestrator:')) {
      return 'status';
    }
    if (eventType.startsWith('conscious:tool_')) {
      return 'tool_call';
    }
    if (eventType.startsWith('memory:')) {
      return 'memory';
    }
    if (eventType.startsWith('learning:') || eventType.startsWith('subconscious:')) {
      return 'skill';
    }
    return 'status';
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalInstance: NexusWebSocketServer | null = null;

export function getWebSocketServer(config?: NexusWSServerConfig): NexusWebSocketServer {
  if (!globalInstance) {
    globalInstance = new NexusWebSocketServer(config);
  }
  return globalInstance;
}

export function closeWebSocketServer(): Promise<void> {
  if (globalInstance) {
    const promise = globalInstance.close();
    globalInstance = null;
    return promise;
  }
  return Promise.resolve();
}
