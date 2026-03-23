/**
 * NEXUS API - Pipeline Endpoint
 * Full implementation using PipelineExecutor with real execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  listPipelines, 
  savePipeline, 
  getPipeline, 
  deletePipeline, 
  executePipeline as executePipelineFromBridge,
  type PipelineNode,
  type PipelineEdge
} from '@/lib/nexus-bridge';

// Get all saved pipelines
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (id) {
      const pipeline = await getPipeline(id);
      if (!pipeline) {
        return NextResponse.json(
          { error: `Pipeline '${id}' not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ pipeline });
    }
    
    const pipelines = await listPipelines();
    
    return NextResponse.json({ 
      pipelines,
      total: pipelines.length
    });
  } catch (error) {
    console.error('Pipeline list error:', error);
    return NextResponse.json(
      { error: 'Failed to list pipelines' },
      { status: 500 }
    );
  }
}

// Create or execute pipeline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, name, description, nodes, edges, input, save } = body;
    
    // Execute existing pipeline
    if (action === 'execute' && id) {
      const execution = await executePipelineFromBridge(id, input || {});
      return NextResponse.json(execution);
    }
    
    // Validate nodes
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: 'Pipeline nodes are required' },
        { status: 400 }
      );
    }
    
    // Validate node structure
    for (const node of nodes) {
      if (!node.id || !node.type || !node.name) {
        return NextResponse.json(
          { error: 'Each node must have id, type, and name' },
          { status: 400 }
        );
      }
      
      const validTypes = ['skill', 'tool', 'http', 'code', 'transform', 'condition', 'loop', 'parallel'];
      if (!validTypes.includes(node.type)) {
        return NextResponse.json(
          { error: `Invalid node type: ${node.type}. Valid types: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }
    
    // Save pipeline
    if (save || name) {
      const pipeline = await savePipeline(
        name || 'Untitled Pipeline',
        description || '',
        nodes as PipelineNode[],
        (edges || []) as PipelineEdge[]
      );
      
      return NextResponse.json({
        success: true,
        pipeline,
        message: 'Pipeline saved successfully'
      });
    }
    
    // Execute inline pipeline
    const tempId = `temp-${crypto.randomUUID()}`;
    await savePipeline(tempId, 'Temporary Pipeline', nodes as PipelineNode[], (edges || []) as PipelineEdge[]);
    
    const execution = await executePipelineFromBridge(tempId, input || {});
    
    // Delete temporary pipeline
    await deletePipeline(tempId);
    
    return NextResponse.json(execution);
    
  } catch (error) {
    console.error('Pipeline execution error:', error);
    return NextResponse.json(
      { error: 'Pipeline execution failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Update pipeline
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, nodes, edges, status } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Pipeline ID is required' },
        { status: 400 }
      );
    }
    
    const existing = await getPipeline(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Pipeline '${id}' not found` },
        { status: 404 }
      );
    }
    
    // Update pipeline
    const updated = await savePipeline(
      name || existing.name,
      description || existing.description,
      nodes || existing.nodes,
      edges || existing.edges
    );
    
    return NextResponse.json({
      success: true,
      pipeline: updated
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update pipeline' },
      { status: 500 }
    );
  }
}

// Delete pipeline
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Pipeline ID is required' },
        { status: 400 }
      );
    }
    
    const deleted = await deletePipeline(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: `Pipeline '${id}' not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Pipeline ${id} deleted` 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete pipeline' },
      { status: 500 }
    );
  }
}
