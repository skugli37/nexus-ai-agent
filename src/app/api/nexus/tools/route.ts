/**
 * NEXUS API - Tools Endpoint
 * CRUD operations for NEXUS tools
 * NO DEFAULTS - All tools loaded from filesystem
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getNexusHome, loadToolsFromFS, Tool } from '@/lib/nexus-core';

// Get tools config path
function getToolsConfigPath(): string {
  return join(getNexusHome(), 'config', 'tools.json');
}

// Save tools to config
function saveTools(tools: Tool[]): void {
  const nexusHome = getNexusHome();
  const configDir = join(nexusHome, 'config');
  const configPath = getToolsConfigPath();
  
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  writeFileSync(configPath, JSON.stringify({ tools }, null, 2));
}

// Get all tools - NO DEFAULTS
export async function GET() {
  const tools = await loadToolsFromFS();
  return NextResponse.json({ tools });
}

// Create new tool
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category, parameters, enabled } = body;
    
    if (!name) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }
    
    const existingTools = await loadToolsFromFS();
    
    // Check if tool already exists
    if (existingTools.find(t => t.name === name)) {
      return NextResponse.json(
        { error: `Tool '${name}' already exists` },
        { status: 409 }
      );
    }
    
    const toolId = name.toLowerCase().replace(/\s+/g, '_');
    
    // Create tool file
    const toolsDir = join(getNexusHome(), 'tools');
    if (!existsSync(toolsDir)) {
      mkdirSync(toolsDir, { recursive: true });
    }
    
    const toolPath = join(toolsDir, `${toolId}.ts`);
    const toolContent = `/**
 * Tool: ${name}
 * ${description || 'Custom tool'}
 */

export const ${toolId.replace(/-/g, '_')} = {
  name: '${name}',
  description: '${description || ''}',
  category: '${category || 'custom'}',
  parameters: ${JSON.stringify(parameters || [], null, 2)},
  
  async execute(args: Record<string, unknown>) {
    // Tool implementation - customize this
    return { 
      success: true, 
      result: args,
      timestamp: new Date().toISOString()
    };
  }
};

export default ${toolId.replace(/-/g, '_')};
`;
    
    writeFileSync(toolPath, toolContent);
    
    const newTool: Tool = {
      id: toolId,
      name,
      description: description || '',
      category: category || 'custom',
      parameters: parameters || [],
      enabled: enabled !== false,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };
    
    // Update config
    existingTools.push(newTool);
    saveTools(existingTools);
    
    return NextResponse.json({
      success: true,
      tool: newTool
    });
  } catch (error) {
    console.error('Failed to create tool:', error);
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
    const { id, name, description, category, parameters, enabled } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      );
    }
    
    const tools = await loadToolsFromFS();
    const toolIndex = tools.findIndex(t => t.id === id);
    
    if (toolIndex === -1) {
      return NextResponse.json(
        { error: `Tool with ID '${id}' not found` },
        { status: 404 }
      );
    }
    
    // Update tool
    tools[toolIndex] = {
      ...tools[toolIndex],
      name: name || tools[toolIndex].name,
      description: description || tools[toolIndex].description,
      category: category || tools[toolIndex].category,
      parameters: parameters || tools[toolIndex].parameters,
      enabled: enabled !== undefined ? enabled : tools[toolIndex].enabled,
      updatedAt: new Date().toISOString()
    };
    
    saveTools(tools);
    
    return NextResponse.json({
      success: true,
      tool: tools[toolIndex]
    });
  } catch (error) {
    console.error('Failed to update tool:', error);
    return NextResponse.json(
      { error: 'Failed to update tool', details: error instanceof Error ? error.message : 'Unknown error' },
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
    
    const tools = await loadToolsFromFS();
    const toolIndex = tools.findIndex(t => t.id === id);
    
    if (toolIndex === -1) {
      return NextResponse.json(
        { error: `Tool with ID '${id}' not found` },
        { status: 404 }
      );
    }
    
    // Remove tool file
    const toolPath = join(getNexusHome(), 'tools', `${id}.ts`);
    if (existsSync(toolPath)) {
      unlinkSync(toolPath);
    }
    
    // Remove from config
    const deletedTool = tools.splice(toolIndex, 1)[0];
    saveTools(tools);
    
    return NextResponse.json({
      success: true,
      message: `Tool '${deletedTool.name}' deleted successfully`
    });
  } catch (error) {
    console.error('Failed to delete tool:', error);
    return NextResponse.json(
      { error: 'Failed to delete tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
