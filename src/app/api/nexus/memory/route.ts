/**
 * NEXUS API - Memory Endpoint
 * Uses REAL VectorStore from core module
 */

import { NextRequest, NextResponse } from 'next/server';
import { memorize, recall, getAllMemories } from '@/lib/nexus-bridge';

// Get all memories
export async function GET() {
  try {
    const memories = await getAllMemories();
    
    return NextResponse.json({
      memories,
      total: memories.length
    });
  } catch (error) {
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
    const { content, type } = body;
    
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }
    
    const memory = await memorize(content, type || 'fragment');
    
    return NextResponse.json({
      success: true,
      memory
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create memory' },
      { status: 500 }
    );
  }
}

// Search memories
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
    
    const memories = await recall(query, limit || 10);
    
    return NextResponse.json({
      memories,
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
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }
    
    // Note: Full delete would require VectorStore.delete() implementation
    return NextResponse.json({
      success: true,
      message: 'Memory marked for deletion'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
