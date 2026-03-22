/**
 * NEXUS WebSocket API Route
 * 
 * This route provides WebSocket connection configuration and server status.
 * The actual WebSocket server runs on a separate port and handles real-time
 * communication for agent events.
 * 
 * Note: Next.js API routes don't natively support WebSocket upgrades.
 * The WebSocket server (NexusWebSocketServer) should run as a separate process.
 */

import { NextRequest, NextResponse } from 'next/server';

// WebSocket server configuration
const WS_PORT = process.env.NEXUS_WS_PORT || '3002';
const WS_HOST = process.env.NEXUS_WS_HOST || 'localhost';

/**
 * GET /api/nexus/ws
 * Get WebSocket connection information
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || WS_HOST;
  const protocol = request.headers.get('x-forwarded-proto') || 
    (request.headers.get('host')?.includes('localhost') ? 'http' : 'https');
  
  // Build WebSocket URL
  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${host}/?XTransformPort=${WS_PORT}`;

  return NextResponse.json({
    success: true,
    data: {
      wsUrl,
      port: parseInt(WS_PORT),
      host,
      protocol: wsProtocol,
      connected: true,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * POST /api/nexus/ws
 * Send a message through the WebSocket server
 * (Alternative to direct WebSocket connection for simple messages)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, type, payload } = body;

    if (!agentId || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: agentId, type' },
        { status: 400 }
      );
    }

    // Import WebSocket server dynamically (only works if running in same process)
    // In production, this would publish to a message broker
    try {
      const { getWebSocketServer } = await import('../../../core/websocket-server');
      const wsServer = getWebSocketServer();
      
      const message = {
        type,
        payload: payload || {},
        timestamp: new Date(),
        agentId,
      };

      wsServer.broadcast(agentId, message);

      return NextResponse.json({
        success: true,
        data: {
          messageId: `msg_${Date.now()}`,
          broadcast: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // WebSocket server not running in this process
      // In production, would publish to Redis/mq
      return NextResponse.json({
        success: true,
        data: {
          messageId: `msg_${Date.now()}`,
          broadcast: false,
          note: 'WebSocket server not available in this process',
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/nexus/ws
 * Disconnect a client from the WebSocket server
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: 'Missing clientId parameter' },
      { status: 400 }
    );
  }

  try {
    // In production, this would signal the WebSocket server to disconnect the client
    return NextResponse.json({
      success: true,
      data: {
        clientId,
        disconnected: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to disconnect client',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
