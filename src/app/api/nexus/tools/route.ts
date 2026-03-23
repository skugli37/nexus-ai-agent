/**
 * NEXUS API - Tools Endpoint
 * Full implementation using Tool Forge capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { listTools, createTool, deleteTool, getNexusHome } from '@/lib/nexus-bridge';
import { existsSync, unlinkSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

// List all tools
export async function GET() {
  try {
    const tools = await listTools();
    
    // Add additional metadata
    const toolsWithMeta = tools.map(tool => ({
      ...tool,
      path: join(getNexusHome(), 'tools', `${tool.id}.ts`)
    }));
    
    return NextResponse.json({ 
      tools: toolsWithMeta,
      total: tools.length
    });
  } catch (error) {
    console.error('Tools list error:', error);
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
    const { name, description, category, parameters, code, timeout, retries, dependencies } = body;
    
    if (!name) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }
    
    // Generate code if not provided
    const toolCode = code || generateToolCode(name, description, parameters, category);
    
    const tool = await createTool(
      name, 
      description || 'Custom tool', 
      toolCode,
      parameters || [],
      category || 'custom'
    );
    
    // Save additional config if provided
    if (timeout || retries || dependencies) {
      const configPath = join(getNexusHome(), 'tools', `${tool.id}.config.json`);
      writeFileSync(configPath, JSON.stringify({
        timeout: timeout || 30000,
        retries: retries || 3,
        dependencies: dependencies || []
      }, null, 2));
    }
    
    return NextResponse.json({
      success: true,
      tool
    });
  } catch (error) {
    console.error('Tool create error:', error);
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
    const { id, enabled, code, description, parameters } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      );
    }
    
    const toolsDir = join(getNexusHome(), 'tools');
    const extensions = ['.ts', '.js', '.py'];
    let toolPath: string | null = null;
    
    for (const ext of extensions) {
      const path = join(toolsDir, `${id}${ext}`);
      if (existsSync(path)) {
        toolPath = path;
        break;
      }
    }
    
    if (!toolPath) {
      return NextResponse.json(
        { error: `Tool '${id}' not found` },
        { status: 404 }
      );
    }
    
    // Update code if provided
    if (code) {
      writeFileSync(toolPath, code);
    }
    
    return NextResponse.json({
      success: true,
      message: `Tool ${id} updated`
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
    
    const deleted = await deleteTool(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: `Tool '${id}' not found` },
        { status: 404 }
      );
    }
    
    // Also delete config file if exists
    const configPath = join(getNexusHome(), 'tools', `${id}.config.json`);
    if (existsSync(configPath)) {
      unlinkSync(configPath);
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

// Helper function to generate tool code
function generateToolCode(
  name: string, 
  description: string, 
  parameters: Array<{ name: string; type: string; description: string; required: boolean }> = [],
  category: string = 'custom'
): string {
  const paramsInterface = parameters.map(p => 
    `  /** ${p.description} */\n  ${p.name}${p.required ? '' : '?'}: ${p.type};`
  ).join('\n');
  
  const validationCode = parameters
    .filter(p => p.required)
    .map(p => `  if (!args.${p.name}) {\n    throw new Error('${p.name} is required');\n  }`)
    .join('\n');
  
  return `/**
 * @name ${name}
 * @description ${description || 'Custom tool for NEXUS agent'}
 * @category ${category}
 * @created ${new Date().toISOString()}
 */

interface ${name.replace(/\s+/g, '')}Args {
${paramsInterface || '  // No parameters defined'}
}

/**
 * Execute the ${name} tool
 * @param args - Tool arguments
 * @returns Tool execution result
 */
export async function execute(args: ${name.replace(/\s+/g, '')}Args): Promise<unknown> {
  // Validate required parameters
${validationCode || '  // No validation required'}
  
  // Tool implementation
  console.log('Executing ${name} with args:', args);
  
  try {
    // TODO: Implement tool logic
    const result = {
      success: true,
      message: '${name} executed successfully',
      args,
      timestamp: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    throw new Error(\`${name} execution failed: \${error instanceof Error ? error.message : 'Unknown error'}\`);
  }
}

export default {
  name: '${name}',
  description: '${description || 'Custom tool'}',
  execute
};
`;
}
