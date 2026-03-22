/**
 * NEXUS API - Tools Endpoint
 * CRUD operations for NEXUS tools
 */

import { NextRequest, NextResponse } from 'next/server'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Get NEXUS home directory
function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus')
}

// Get tools config path
function getToolsConfigPath(): string {
  return join(getNexusHome(), 'config', 'tools.json')
}

// Tool interface
interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
}

interface Tool {
  id: string
  name: string
  description: string
  category: string
  parameters: ToolParameter[]
  enabled: boolean
  lastUsed?: string
  usageCount: number
  createdAt?: string
  updatedAt?: string
}

// Default tools
const defaultTools: Tool[] = [
  {
    id: 'code_execution',
    name: 'code_execution',
    description: 'Execute Python, JavaScript, or shell commands in a sandboxed environment',
    category: 'execution',
    parameters: [
      { name: 'code', type: 'string', description: 'Code to execute', required: true },
      { name: 'runtime', type: 'string', description: 'Runtime to use (python, nodejs, terminal)', required: true }
    ],
    enabled: true,
    usageCount: 127
  },
  {
    id: 'memorize',
    name: 'memorize',
    description: 'Store and retrieve information from persistent memory',
    category: 'memory',
    parameters: [
      { name: 'content', type: 'string', description: 'Content to store', required: true },
      { name: 'area', type: 'string', description: 'Memory area (main, fragments, solutions)', required: false }
    ],
    enabled: true,
    usageCount: 89
  },
  {
    id: 'web_search',
    name: 'web_search',
    description: 'Search the web for information',
    category: 'web',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'num', type: 'number', description: 'Number of results', required: false }
    ],
    enabled: true,
    usageCount: 45
  },
  {
    id: 'browser_action',
    name: 'browser_action',
    description: 'Control a headless browser for web automation',
    category: 'web',
    parameters: [
      { name: 'action', type: 'string', description: 'Action to perform', required: true },
      { name: 'url', type: 'string', description: 'URL to navigate', required: false }
    ],
    enabled: true,
    usageCount: 23
  },
  {
    id: 'response',
    name: 'response',
    description: 'Send a response to the user',
    category: 'system',
    parameters: [
      { name: 'message', type: 'string', description: 'Response message', required: true }
    ],
    enabled: true,
    usageCount: 312
  },
  {
    id: 'call_subordinate',
    name: 'call_subordinate',
    description: 'Delegate a task to a subordinate agent',
    category: 'execution',
    parameters: [
      { name: 'task', type: 'string', description: 'Task description', required: true },
      { name: 'profile', type: 'string', description: 'Agent profile to use', required: false }
    ],
    enabled: true,
    usageCount: 15
  }
]

// Load tools from config
function loadTools(): Tool[] {
  const configPath = getToolsConfigPath()
  
  if (!existsSync(configPath)) {
    // Return default tools if no config exists
    return defaultTools
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content) as { tools: Tool[] }
    return config.tools || defaultTools
  } catch {
    return defaultTools
  }
}

// Save tools to config
function saveTools(tools: Tool[]): void {
  const nexusHome = getNexusHome()
  const configDir = join(nexusHome, 'config')
  const configPath = getToolsConfigPath()
  
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
  
  writeFileSync(configPath, JSON.stringify({ tools }, null, 2))
}

// Get all tools
export async function GET() {
  const tools = loadTools()
  return NextResponse.json({ tools })
}

// Create new tool
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, category, parameters, enabled } = body
    
    if (!name) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      )
    }
    
    const tools = loadTools()
    
    // Check if tool already exists
    if (tools.find(t => t.name === name)) {
      return NextResponse.json(
        { error: `Tool '${name}' already exists` },
        { status: 409 }
      )
    }
    
    const newTool: Tool = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      description: description || '',
      category: category || 'default',
      parameters: parameters || [],
      enabled: enabled !== false,
      usageCount: 0,
      createdAt: new Date().toISOString()
    }
    
    tools.push(newTool)
    saveTools(tools)
    
    return NextResponse.json({
      success: true,
      tool: newTool
    })
  } catch (error) {
    console.error('Failed to create tool:', error)
    return NextResponse.json(
      { error: 'Failed to create tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Update tool
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, category, parameters, enabled } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      )
    }
    
    const tools = loadTools()
    const toolIndex = tools.findIndex(t => t.id === id)
    
    if (toolIndex === -1) {
      return NextResponse.json(
        { error: `Tool with ID '${id}' not found` },
        { status: 404 }
      )
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
    }
    
    saveTools(tools)
    
    return NextResponse.json({
      success: true,
      tool: tools[toolIndex]
    })
  } catch (error) {
    console.error('Failed to update tool:', error)
    return NextResponse.json(
      { error: 'Failed to update tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Delete tool
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      )
    }
    
    const tools = loadTools()
    const toolIndex = tools.findIndex(t => t.id === id)
    
    if (toolIndex === -1) {
      return NextResponse.json(
        { error: `Tool with ID '${id}' not found` },
        { status: 404 }
      )
    }
    
    // Remove tool
    const deletedTool = tools.splice(toolIndex, 1)[0]
    saveTools(tools)
    
    return NextResponse.json({
      success: true,
      message: `Tool '${deletedTool.name}' deleted successfully`
    })
  } catch (error) {
    console.error('Failed to delete tool:', error)
    return NextResponse.json(
      { error: 'Failed to delete tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
