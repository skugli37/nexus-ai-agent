/**
 * NEXUS API - Chat Endpoint
 * Full implementation using REAL Agent with AI integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgent, memorize, getAllMemories, processChatMessage, type ChatMessage } from '@/lib/nexus-bridge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message as string;
    const history = body.history as ChatMessage[] | undefined;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Process message through REAL agent with AI
    const response = await processChatMessage(message, history || []);
    
    // Auto-memorize important conversations
    if (message.length > 50 && (
      message.toLowerCase().includes('remember') ||
      message.toLowerCase().includes('important') ||
      message.toLowerCase().includes('note') ||
      message.toLowerCase().includes('save')
    )) {
      await memorize(`User: ${message.slice(0, 500)}`, 'main');
    } else if (message.length > 20) {
      await memorize(`User: ${message.slice(0, 200)}`, 'fragment');
    }
    
    // Memorize assistant response
    await memorize(`Assistant: ${response.content.slice(0, 200)}`, 'fragment');
    
    return NextResponse.json({
      response: response.content,
      id: response.id,
      timestamp: response.timestamp,
      metadata: response.metadata
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
export async function GET() {
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
