/**
 * NEXUS API - Pipeline Endpoint
 * Uses REAL PipelineExecutor from core
 */

import { NextRequest, NextResponse } from 'next/server';
import { executePipeline } from '@/lib/pipeline-executor';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getNexusHome } from '@/lib/nexus-bridge';

// Get all saved pipelines
export async function GET() {
  const pipelinesDir = join(getNexusHome(), 'pipelines');
  const pipelines: Array<{ id: string; name: string; createdAt: string }> = [];
  
  if (!existsSync(pipelinesDir)) {
    return NextResponse.json({ pipelines });
  }
  
  const files = readdirSync(pipelinesDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = readFileSync(join(pipelinesDir, file), 'utf-8');
        const pipeline = JSON.parse(content);
        pipelines.push({
          id: pipeline.id || file,
          name: pipeline.name || file.replace('.json', ''),
          createdAt: pipeline.metadata?.createdAt || pipeline.createdAt || new Date().toISOString()
        });
      } catch {}
    }
  }
  
  return NextResponse.json({ pipelines });
}

// Execute pipeline using REAL executor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, nodes, connections, save } = body;
    
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: 'Pipeline nodes are required' },
        { status: 400 }
      );
    }
    
    // Execute using REAL pipeline executor
    const result = await executePipeline(
      name || 'Untitled Pipeline',
      nodes.map((n: { id: string; type: string; name: string; config: Record<string, unknown> }) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        config: n.config || {}
      })),
      connections || []
    );
    
    // Save pipeline if requested
    if (save) {
      const pipelinesDir = join(getNexusHome(), 'pipelines');
      if (!existsSync(pipelinesDir)) {
        mkdirSync(pipelinesDir, { recursive: true });
      }
      
      writeFileSync(
        join(pipelinesDir, `${result.pipelineId}.json`),
        JSON.stringify({
          id: result.pipelineId,
          name: name || 'Untitled Pipeline',
          nodes,
          connections: connections || [],
          createdAt: new Date().toISOString(),
          lastExecution: {
            executionId: result.executionId,
            success: result.success,
            totalExecutionTime: result.totalExecutionTime
          }
        }, null, 2)
      );
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Pipeline execution error:', error);
    return NextResponse.json(
      { error: 'Pipeline execution failed', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Pipeline ID is required' }, { status: 400 });
    }
    
    const pipelinePath = join(getNexusHome(), 'pipelines', `${id}.json`);
    if (existsSync(pipelinePath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(pipelinePath);
    }
    
    return NextResponse.json({ success: true, message: `Pipeline ${id} deleted` });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete pipeline' },
      { status: 500 }
    );
  }
}
