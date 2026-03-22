'use client';

/**
 * NEXUS WebSocket React Hook
 * Type-safe WebSocket connection for real-time agent communication
 * 
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Message queuing when disconnected
 * - Event subscriptions with type filtering
 * - Proper cleanup on unmount
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type NexusWSMessageType = 
  | 'status'      
  | 'chat'        
  | 'tool_call'   
  | 'memory'      
  | 'skill'       
  | 'error'       
  | 'heartbeat'   
  | 'subscribe'   
  | 'unsubscribe' 
  | 'history';

export interface NexusWSMessage {
  type: NexusWSMessageType;
  payload: unknown;
  timestamp: string | Date;
  agentId: string;
  messageId?: string;
}

export interface UseNexusWebSocketOptions {
  agentId: string;
  url?: string;
  autoConnect?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  maxQueueSize?: number;
  eventTypes?: string[];
  onMessage?: (message: NexusWSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export interface UseNexusWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  messages: NexusWSMessage[];
  error: Error | null;
  reconnectAttempts: number;
  clientId: string | null;
  send: (type: NexusWSMessageType, payload: unknown) => boolean;
  subscribe: (eventTypes: string[]) => void;
  unsubscribe: (eventTypes: string[]) => void;
  subscribeAgent: (agentId: string) => void;
  unsubscribeAgent: (agentId: string) => void;
  clearMessages: () => void;
  reconnect: () => void;
  disconnect: () => void;
  connect: () => void;
  flushQueue: () => void;
  queueSize: number;
}

interface QueuedMessage {
  type: NexusWSMessageType;
  payload: unknown;
  timestamp: Date;
  attempts: number;
}

// ============================================================================
// WEBSOCKET HOOK
// ============================================================================

export function useNexusWebSocket(options: UseNexusWebSocketOptions): UseNexusWebSocketReturn {
  const {
    agentId,
    url,
    autoConnect = true,
    autoReconnect = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
    maxQueueSize = 100,
    eventTypes = [],
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<NexusWSMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [queueSize, setQueueSize] = useState(0);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const connectRef = useRef<() => void>(() => {});

  // Computed WebSocket URL
  const wsUrl = useMemo(() => {
    if (url) return url;
    
    // Build URL based on current location
    if (typeof window === 'undefined') return '';
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Use XTransformPort for Caddy routing
    const port = process.env.NEXT_PUBLIC_WS_PORT || '3002';
    const path = `/?XTransformPort=${port}`;
    
    return `${protocol}//${host}${path}`;
  }, [url]);

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'heartbeat',
          payload: { timestamp: new Date().toISOString() },
          timestamp: new Date(),
          agentId,
        }));
      }
    }, 30000); // 30 second heartbeat
  }, [agentId, clearHeartbeat]);

  const flushQueueInternal = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const queue = messageQueueRef.current;
    if (queue.length === 0) return;

    const failedMessages: QueuedMessage[] = [];

    queue.forEach(msg => {
      try {
        wsRef.current!.send(JSON.stringify({
          type: msg.type,
          payload: msg.payload,
          timestamp: msg.timestamp,
          agentId,
        }));
      } catch {
        // Re-queue failed messages
        if (msg.attempts < 3) {
          failedMessages.push({ ...msg, attempts: msg.attempts + 1 });
        }
      }
    });

    messageQueueRef.current = failedMessages;
  }, [agentId]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    clearHeartbeat();
    
    if (wsRef.current) {
      // Send unsubscribe before closing
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe',
          payload: { agentId },
          timestamp: new Date(),
          agentId,
        }));
      }
      
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  }, [agentId, clearReconnectTimeout, clearHeartbeat]);

  // Store callbacks in refs to avoid circular dependencies
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);
  const autoReconnectRef = useRef(autoReconnect);
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts);
  const reconnectIntervalRef_ = useRef(reconnectInterval);

  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
    onMessageRef.current = onMessage;
    autoReconnectRef.current = autoReconnect;
    maxReconnectAttemptsRef.current = maxReconnectAttempts;
    reconnectIntervalRef_.current = reconnectInterval;
  }, [onConnect, onDisconnect, onError, onMessage, autoReconnect, maxReconnectAttempts, reconnectInterval]);

  // Define the connect function that will be stored in ref
  useEffect(() => {
    const doConnect = () => {
      if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN) return;

      setIsConnecting(true);
      setError(null);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          
          setIsConnected(true);
          setIsConnecting(false);
          reconnectAttemptsRef.current = 0;
          setReconnectAttempts(0);
          setError(null);

          // Subscribe to agent
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { agentId, eventTypes: eventTypes.length > 0 ? eventTypes : ['*'] },
            timestamp: new Date(),
            agentId,
          }));

          // Start heartbeat
          startHeartbeat();

          // Flush queued messages
          flushQueueInternal();

          onConnectRef.current?.();
        };

        ws.onclose = (event) => {
          if (!mountedRef.current) return;
          
          setIsConnected(false);
          setIsConnecting(false);
          setClientId(null);
          clearHeartbeat();

          const reason = event.reason || 'Connection closed';
          onDisconnectRef.current?.(reason);

          // Auto-reconnect
          if (autoReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
            const delay = Math.min(
              reconnectIntervalRef_.current * Math.pow(2, reconnectAttemptsRef.current),
              30000 // Max 30 seconds
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                reconnectAttemptsRef.current += 1;
                setReconnectAttempts(reconnectAttemptsRef.current);
                connectRef.current();
              }
            }, delay);
          }
        };

        ws.onerror = () => {
          if (!mountedRef.current) return;
          
          const err = new Error('WebSocket error');
          setError(err);
          setIsConnecting(false);
          onErrorRef.current?.(err);
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          
          try {
            const message: NexusWSMessage = JSON.parse(event.data);
            
            // Handle different message types
            switch (message.type) {
              case 'status': {
                // Extract client ID from welcome message
                const statusPayload = message.payload as { clientId?: string };
                if (statusPayload.clientId) {
                  setClientId(statusPayload.clientId);
                }
                break;
              }
              case 'error': {
                const errorPayload = message.payload as { message: string };
                setError(new Error(errorPayload.message));
                break;
              }
              case 'heartbeat':
                // Heartbeat response - update connection status
                break;
            }

            // Add to messages
            setMessages(prev => {
              const newMessages = [...prev, message];
              // Limit messages to prevent memory issues
              if (newMessages.length > 500) {
                return newMessages.slice(-500);
              }
              return newMessages;
            });

            onMessageRef.current?.(message);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

      } catch (e) {
        const err = e instanceof Error ? e : new Error('Connection failed');
        setError(err);
        setIsConnecting(false);
        onErrorRef.current?.(err);
      }
    };

    connectRef.current = doConnect;
  }, [wsUrl, agentId, eventTypes, startHeartbeat, clearHeartbeat, flushQueueInternal]);

  const connect = useCallback(() => {
    connectRef.current();
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    setTimeout(() => connectRef.current(), 100);
  }, [disconnect]);

  // ============================================================================
  // MESSAGE QUEUE
  // ============================================================================

  const flushQueue = useCallback(() => {
    flushQueueInternal();
    setQueueSize(messageQueueRef.current.length);
  }, [flushQueueInternal]);

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  const send = useCallback((type: NexusWSMessageType, payload: unknown): boolean => {
    const message: QueuedMessage = {
      type,
      payload,
      timestamp: new Date(),
      attempts: 0,
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: message.type,
          payload: message.payload,
          timestamp: message.timestamp,
          agentId,
        }));
        return true;
      } catch {
        // Queue on failure
      }
    }

    // Queue message when disconnected
    if (messageQueueRef.current.length < maxQueueSize) {
      messageQueueRef.current.push(message);
      setQueueSize(messageQueueRef.current.length);
    }

    return false;
  }, [agentId, maxQueueSize]);

  const subscribe = useCallback((types: string[]) => {
    send('subscribe', { eventTypes: types });
  }, [send]);

  const unsubscribe = useCallback((types: string[]) => {
    send('unsubscribe', { eventTypes: types });
  }, [send]);

  const subscribeAgent = useCallback((targetAgentId: string) => {
    send('subscribe', { agentId: targetAgentId });
  }, [send]);

  const unsubscribeAgent = useCallback((targetAgentId: string) => {
    send('unsubscribe', { agentId: targetAgentId });
  }, [send]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;
    
    if (autoConnect && wsUrl) {
      connectRef.current();
    }

    return () => {
      mountedRef.current = false;
      clearReconnectTimeout();
      clearHeartbeat();
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [autoConnect, wsUrl, clearReconnectTimeout, clearHeartbeat]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    isConnected,
    isConnecting,
    messages,
    error,
    reconnectAttempts,
    clientId,
    send,
    subscribe,
    unsubscribe,
    subscribeAgent,
    unsubscribeAgent,
    clearMessages,
    reconnect,
    disconnect,
    connect,
    flushQueue,
    queueSize,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for subscribing to specific event types only
 */
export function useNexusEvents(
  agentId: string,
  eventTypes: string[],
  handler: (message: NexusWSMessage) => void
): UseNexusWebSocketReturn {
  const result = useNexusWebSocket({
    agentId,
    eventTypes,
    onMessage: (message) => {
      if (eventTypes.includes(message.type) || eventTypes.includes('*')) {
        handler(message);
      }
    },
  });

  return result;
}

/**
 * Hook for subscribing to status updates only
 */
export function useNexusStatus(
  agentId: string,
  onStatusChange?: (status: unknown) => void
): UseNexusWebSocketReturn {
  return useNexusWebSocket({
    agentId,
    eventTypes: ['status'],
    onMessage: (message) => {
      if (message.type === 'status') {
        onStatusChange?.(message.payload);
      }
    },
  });
}

/**
 * Hook for subscribing to tool calls only
 */
export function useNexusToolCalls(
  agentId: string,
  onToolCall?: (toolCall: unknown) => void
): UseNexusWebSocketReturn {
  return useNexusWebSocket({
    agentId,
    eventTypes: ['tool_call'],
    onMessage: (message) => {
      if (message.type === 'tool_call') {
        onToolCall?.(message.payload);
      }
    },
  });
}

/**
 * Hook for subscribing to memory updates only
 */
export function useNexusMemory(
  agentId: string,
  onMemoryUpdate?: (memory: unknown) => void
): UseNexusWebSocketReturn {
  return useNexusWebSocket({
    agentId,
    eventTypes: ['memory'],
    onMessage: (message) => {
      if (message.type === 'memory') {
        onMemoryUpdate?.(message.payload);
      }
    },
  });
}

export default useNexusWebSocket;
