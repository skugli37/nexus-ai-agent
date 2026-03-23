/**
 * NEXUS API - Pipeline Endpoint
 * Create, save, and execute pipelines
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Get NEXUS home directory
function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus');
}

// Pipeline storage path
function getPipelinePath(): string {
  const path = join(getNexusHome(), 'pipelines');
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
  return path;
}

// GET - List all pipelines
export async function GET(request: NextRequest) {
  try {
    const pipelinePath = getPipelinePath();
    const { readdirSync } = await import('fs');
    
    const files = readdirSync(pipelinePath).filter(f => f.endsWith('.json'));
    const pipelines = files.map(file => {
      try {
        const content = readFileSync(join(pipelinePath, file), 'utf-8');
        const pipeline = JSON.parse(content);
        return {
          id: file.replace('.json', ''),
          name: pipeline.name,
          nodeCount: pipeline.nodes?.length || 0,
          createdAt: pipeline.createdAt
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({ pipelines });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list pipelines' },
      { status: 500 }
    );
  }
}

// POST - Create or save a pipeline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, nodes, connections, variables } = body;

    if (!name || !nodes) {
      return NextResponse.json(
        { error: 'Pipeline name and nodes are required' },
        { status: 400 }
      );
    }

    const pipelineId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const pipelinePath = getPipelinePath();
    
    const pipeline = {
      id: pipelineId,
      name,
      version: '1.0.0',
      nodes,
      connections: connections || [],
      variables: variables || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    writeFileSync(
      join(pipelinePath, `${pipelineId}.json`),
      JSON.stringify(pipeline, null, 2)
    );

    return NextResponse.json({
      success: true,
      pipelineId,
      message: `Pipeline "${name}" saved successfully`
    });
  } catch (error) {
    console.error('Pipeline save error:', error);
    return NextResponse.json(
      { error: 'Failed to save pipeline' },
      { status: 500 }
    );
  }
}

// PUT - Execute a pipeline
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { pipelineId, inputs } = body;

    if (!pipelineId) {
      return NextResponse.json(
        { error: 'Pipeline ID is required' },
        { status: 400 }
      );
    }

    // Load pipeline
    const pipelinePath = join(getPipelinePath(), `${pipelineId}.json`);
    if (!existsSync(pipelinePath)) {
      return NextResponse.json(
        { error: `Pipeline "${pipelineId}" not found` },
        { status: 404 }
      );
    }

    const pipeline = JSON.parse(readFileSync(pipelinePath, 'utf-8'));

    // For now, return a mock execution result
    // In full implementation, this would use the PipelineExecutor
    const results = pipeline.nodes.map((node: any, index: number) => ({
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      status: 'completed',
      output: { result: `Executed ${node.type} node` },
      executionTime: Math.random() * 1000
    }));

    return NextResponse.json({
      success: true,
      pipelineId,
      executionId: `exec-${Date.now()}`,
      results,
      totalExecutionTime: results.reduce((sum: number, r: any) => sum + r.executionTime, 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pipeline execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute pipeline' },
      { status: 500 }
    );
  }
}
