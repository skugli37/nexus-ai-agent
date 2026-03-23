/**
 * NEXUS API - Web Search Endpoint
 * Full implementation using z-ai-web-dev-sdk
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface SearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
  date: string;
  favicon: string;
}

/**
 * POST /api/nexus/search
 * Search the web for information
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, num = 10, recency_days } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Initialize Z-AI SDK
    const zai = await ZAI.create();
    
    // Perform web search
    const searchResult = await zai.functions.invoke('web_search', {
      query,
      num,
      ...(recency_days && { recency_days })
    });

    // Format results
    const results: SearchResult[] = Array.isArray(searchResult) 
      ? searchResult 
      : (searchResult as { results?: SearchResult[] }).results || [];

    return NextResponse.json({
      success: true,
      query,
      count: results.length,
      results: results.map((r, index) => ({
        id: index + 1,
        title: r.name || 'Untitled',
        url: r.url,
        snippet: r.snippet || '',
        domain: r.host_name || new URL(r.url || 'https://example.com').hostname,
        rank: r.rank || index + 1,
        date: r.date || null,
        favicon: r.favicon || null,
      })),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Search error:', error);
    
    // Fallback: Use DuckDuckGo instant answer API
    try {
      const body = await request.json();
      const { query } = body;
      
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      const data = await response.json();
      
      const results: SearchResult[] = [];
      
      // Add main result if available
      if (data.AbstractText) {
        results.push({
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          name: data.Heading || query,
          snippet: data.AbstractText,
          host_name: new URL(data.AbstractURL || 'https://duckduckgo.com').hostname,
          rank: 1,
          date: '',
          favicon: data.Image || '',
        });
      }
      
      // Add related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 9)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              url: topic.FirstURL,
              name: topic.Text.split(' - ')[0] || topic.FirstURL,
              snippet: topic.Text,
              host_name: new URL(topic.FirstURL).hostname,
              rank: results.length + 1,
              date: '',
              favicon: topic.Icon?.URL || '',
            });
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        query,
        count: results.length,
        results,
        source: 'DuckDuckGo (fallback)',
        timestamp: new Date().toISOString(),
      });
      
    } catch (fallbackError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Search failed',
          details: error instanceof Error ? error.message : 'Unknown error' 
        },
        { status: 500 }
      );
    }
  }
}

/**
 * GET /api/nexus/search
 * Quick search via query parameter
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const num = parseInt(searchParams.get('num') || '10');
  
  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter q is required' },
      { status: 400 }
    );
  }

  // Reuse POST handler
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ query, num }),
    headers: { 'Content-Type': 'application/json' }
  }));
}
