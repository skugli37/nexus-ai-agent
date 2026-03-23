/**
 * NEXUS API - Chat Endpoint
 * Uses REAL Agent from core module
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgent, memorize, getAllMemories } from '@/lib/nexus-bridge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message as string;
    const sessionId = body.sessionId as string | undefined;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Get REAL agent instance
    const agent = await getAgent();
    
    // Process message through REAL agent
    const result = await agent.processInput({
      type: 'message',
      content: message,
      sessionId
    });
    
    // Extract response
    const response = result.output?.content || result.output?.message || 'I processed your request.';
    
    // Auto-memorize important conversations
    if (message.length > 50 && (
      message.toLowerCase().includes('remember') ||
      message.toLowerCase().includes('important') ||
      message.toLowerCase().includes('note')
    )) {
      await memorize(`User: ${message.slice(0, 500)}`, 'main');
    } else {
      await memorize(`User: ${message.slice(0, 200)}`, 'fragment');
    }
    
    return NextResponse.json({
      response,
      sessionId: result.sessionId || sessionId,
      tokensUsed: result.tokensUsed || 0,
      processingTime: result.processingTime || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process message', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get chat history
export async function GET(request: NextRequest) {
  try {
    const memories = await getAllMemories();
    
    // Filter only chat-related memories
    const chatHistory = memories
      .filter(m => m.content.startsWith('User:') || m.content.startsWith('Assistant:'))
      .slice(-50)
      .map(m => ({
        role: m.content.startsWith('User:') ? 'user' : 'assistant',
        content: m.content.replace(/^(User|Assistant):\s*/, ''),
        timestamp: m.timestamp
      }));
    
    return NextResponse.json({
      history: chatHistory,
      total: memories.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get history' },
      { status: 500 }
    );
  }
}
