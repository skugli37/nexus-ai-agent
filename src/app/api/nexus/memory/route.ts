/**
 * NEXUS API - Memory Endpoint
 * Full implementation using VectorStore with embeddings
 */

import { NextRequest, NextResponse } from 'next/server';
import { memorize, recall, getAllMemories, getMemory, deleteMemory, clearMemories } from '@/lib/nexus-bridge';

// Get all memories or search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '100');
    const type = searchParams.get('type');
    
    if (query) {
      // Search memories using vector similarity
      const results = await recall(query, limit);
      
      return NextResponse.json({
        results: results.map(r => ({
          memory: r.memory,
          score: r.score,
          highlights: r.highlights
        })),
        query,
        total: results.length
      });
    }
    
    // Get all memories
    let memories = await getAllMemories();
    
    // Filter by type if specified
    if (type && ['main', 'fragment', 'solution'].includes(type)) {
      memories = memories.filter(m => m.type === type);
    }
    
    // Sort by timestamp descending
    memories.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Calculate stats
    const stats = {
      total: memories.length,
      byType: memories.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgImportance: memories.reduce((sum, m) => sum + m.importance, 0) / (memories.length || 1)
    };
    
    return NextResponse.json({
      memories: memories.slice(0, limit),
      stats,
      hasMore: memories.length > limit
    });
  } catch (error) {
    console.error('Memory get error:', error);
    return NextResponse.json(
      { error: 'Failed to get memories' },
      { status: 500 }
    );
  }
}

// Create new memory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, type, tags, importance, metadata } = body;
    
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }
    
    const memory = await memorize(content, type || 'fragment');
    
    // Update with additional metadata if provided
    if (tags) memory.tags = tags;
    if (importance) memory.importance = importance;
    if (metadata) memory.metadata = metadata;
    
    return NextResponse.json({
      success: true,
      memory
    });
  } catch (error) {
    console.error('Memory create error:', error);
    return NextResponse.json(
      { error: 'Failed to create memory' },
      { status: 500 }
    );
  }
}

// Search memories (alternative endpoint)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    const results = await recall(query, limit || 10);
    
    return NextResponse.json({
      results,
      query
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to search memories' },
      { status: 500 }
    );
  }
}

// Delete memory
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll');
    
    if (clearAll === 'true') {
      await clearMemories();
      return NextResponse.json({
        success: true,
        message: 'All memories cleared'
      });
    }
    
    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }
    
    const deleted = await deleteMemory(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: `Memory '${id}' not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Memory ${id} deleted`
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
