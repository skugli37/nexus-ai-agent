/**
 * NEXUS API - Chat Endpoint
 * Full implementation using REAL Agent with AI integration
 * Includes code execution and web search tool detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgent, memorize, getAllMemories, processChatMessage, type ChatMessage } from '@/lib/nexus-bridge';
import ZAI from 'z-ai-web-dev-sdk';

// Tool detection patterns
const CODE_EXECUTION_PATTERNS = [
  /```(?:javascript|typescript|js|ts)\n([\s\S]*?)```/g,
  /(?:execute|run|eval)\s+(?:this\s+)?(?:code|script)/i,
  /create\s+(?:a\s+)?(?:file|script|program)/i,
  /write\s+(?:a\s+)?(?:file|script)/i,
];

const WEB_SEARCH_PATTERNS = [
  /(?:search|google|look up|find)\s+(?:for\s+|info(?:rmation)?\s+(?:about\s+)?)/i,
  /what(?:'s|\s+is)\s+(?:the\s+)?(?:latest|current|recent)/i,
  /(?:who|what|where|when|why|how)\s+(?:is|are|was|were|did|does|do)\s+\w/i,
];

interface ToolResult {
  type: 'code' | 'search';
  success: boolean;
  output?: unknown;
  error?: string;
  logs?: string[];
  results?: unknown[];
}

/**
 * POST /api/nexus/chat
 * Process chat message with tool detection and execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message as string;
    const history = body.history as ChatMessage[] | undefined;
    const tools = body.tools as string[] | undefined; // Enable specific tools
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    const toolResults: ToolResult[] = [];
    let enhancedMessage = message;
    
    // Detect and execute code
    if (tools?.includes('code') || CODE_EXECUTION_PATTERNS.some(p => p.test(message))) {
      const codeMatch = message.match(/```(?:javascript|typescript|js|ts)\n([\s\S]*?)```/);
      if (codeMatch) {
        const codeResult = await executeCode(codeMatch[1]);
        toolResults.push(codeResult);
        enhancedMessage += `\n\n[Code Execution Result: ${codeResult.success ? 'Success' : 'Failed'}]\n${JSON.stringify(codeResult.output || codeResult.error, null, 2)}`;
      }
    }
    
    // Detect and perform web search
    if (tools?.includes('search') || WEB_SEARCH_PATTERNS.some(p => p.test(message))) {
      // Extract search query
      const searchQuery = extractSearchQuery(message);
      if (searchQuery) {
        const searchResult = await performSearch(searchQuery);
        toolResults.push(searchResult);
        if (searchResult.success && searchResult.results) {
          enhancedMessage += `\n\n[Web Search Results for "${searchQuery}"]\n${
            (searchResult.results as Array<{title: string; snippet: string; url: string}>)
              .slice(0, 3)
              .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`)
              .join('\n')
          }`;
        }
      }
    }
    
    // Process message through REAL agent with AI
    const response = await processChatMessage(enhancedMessage, history || []);
    
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
      metadata: {
        ...response.metadata,
        toolsUsed: toolResults.map(t => t.type),
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      }
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

// Helper: Execute code
async function executeCode(code: string): Promise<ToolResult> {
  try {
    // Call internal execute API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/nexus/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, timeout: 30000 })
    });
    
    const result = await response.json();
    
    return {
      type: 'code',
      success: result.success,
      output: result.output,
      error: result.error,
      logs: result.logs,
    };
  } catch (error) {
    return {
      type: 'code',
      success: false,
      error: error instanceof Error ? error.message : 'Code execution failed',
    };
  }
}

// Helper: Perform web search
async function performSearch(query: string): Promise<ToolResult> {
  try {
    const zai = await ZAI.create();
    
    const results = await zai.functions.invoke('web_search', {
      query,
      num: 5
    });
    
    return {
      type: 'search',
      success: true,
      results: Array.isArray(results) ? results : (results as { results?: unknown[] }).results || [],
    };
  } catch (error) {
    // Fallback to DuckDuckGo
    try {
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
      );
      const data = await response.json();
      
      const results = [];
      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          snippet: data.AbstractText,
          url: data.AbstractURL || '',
        });
      }
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 4)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0],
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        }
      }
      
      return {
        type: 'search',
        success: true,
        results,
      };
    } catch {
      return {
        type: 'search',
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }
}

// Helper: Extract search query from message
function extractSearchQuery(message: string): string | null {
  // Common patterns
  const patterns = [
    /search\s+(?:for\s+)?["']?([^"']+)["']?/i,
    /google\s+["']?([^"']+)["']?/i,
    /look\s+up\s+["']?([^"']+)["']?/i,
    /find\s+(?:info(?:rmation)?\s+(?:about\s+)?)?["']?([^"']+)["']?/i,
    /what(?:'s|\s+is)\s+(?:the\s+)?(?:latest|current|recent)\s+(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // If it's a question, use the whole message
  if (/^(?:who|what|where|when|why|how)/i.test(message)) {
    return message;
  }
  
  return null;
}
