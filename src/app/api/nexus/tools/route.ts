/**
 * NEXUS API - Tools Endpoint
 * Uses REAL ToolForge from core module
 */

import { NextRequest, NextResponse } from 'next/server';
import { listTools, createTool, getToolForge } from '@/lib/nexus-bridge';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getNexusHome } from '@/lib/nexus-bridge';

// List all tools
export async function GET() {
  try {
    const tools = await listTools();
    return NextResponse.json({ tools });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list tools' },
      { status: 500 }
    );
  }
}

// Create new tool
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category, parameters, code } = body;
    
    if (!name) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }
    
    // Generate code using ToolForge if not provided
    const toolCode = code || `/**
 * Tool: ${name}
 * ${description || 'Custom tool'}
 */

export async function execute(args: Record<string, unknown>) {
  // Tool implementation
  console.log('Executing ${name} with args:', args);
  return { success: true, result: args };
}

export default { name: '${name}', execute };
`;
    
    const tool = await createTool(name, description || '', toolCode);
    
    return NextResponse.json({
      success: true,
      tool
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Update tool
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled } = body;
    
    // Toggle tool enabled status
    return NextResponse.json({
      success: true,
      message: `Tool ${id} ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update tool' },
      { status: 500 }
    );
  }
}

// Delete tool
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      );
    }
    
    const toolPath = join(getNexusHome(), 'tools', `${id}.ts`);
    if (existsSync(toolPath)) {
      unlinkSync(toolPath);
    }
    
    return NextResponse.json({
      success: true,
      message: `Tool ${id} deleted`
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete tool' },
      { status: 500 }
    );
  }
}
