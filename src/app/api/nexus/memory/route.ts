/**
 * NEXUS API - Memory Endpoint
 * Handles memory operations (list, clear)
 */

import { NextRequest, NextResponse } from 'next/server'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Get NEXUS home directory
function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus')
}

// GET - List memories
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '50')
  
  const memoryPath = join(getNexusHome(), 'memory', 'memory.json')
  
  if (!existsSync(memoryPath)) {
    return NextResponse.json({ memories: [], total: 0 })
  }
  
  try {
    const content = readFileSync(memoryPath, 'utf-8')
    let memories = JSON.parse(content) as Array<{ type: string }>
    
    if (type) {
      memories = memories.filter(m => m.type === type)
    }
    
    return NextResponse.json({
      memories: memories.slice(-limit),
      total: memories.length
    })
  } catch {
    return NextResponse.json({ memories: [], total: 0 })
  }
}

// DELETE - Clear all memories
export async function DELETE() {
  const memoryPath = join(getNexusHome(), 'memory', 'memory.json')
  
  if (!existsSync(memoryPath)) {
    return NextResponse.json({ success: true, message: 'No memories to clear' })
  }
  
  try {
    unlinkSync(memoryPath)
    return NextResponse.json({ success: true, message: 'All memories cleared' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to clear memories', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Store a new memory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, type = 'fragment' } = body
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }
    
    const memoryDir = join(getNexusHome(), 'memory')
    const memoryPath = join(memoryDir, 'memory.json')
    
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true })
    }
    
    let memories: Array<{ id: string; content: string; type: string; timestamp: string }> = []
    
    if (existsSync(memoryPath)) {
      try {
        memories = JSON.parse(readFileSync(memoryPath, 'utf-8'))
      } catch {
        memories = []
      }
    }
    
    const newMemory = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      content,
      type,
      timestamp: new Date().toISOString()
    }
    
    memories.push(newMemory)
    
    // Keep only last 100 memories
    if (memories.length > 100) {
      memories = memories.slice(-100)
    }
    
    writeFileSync(memoryPath, JSON.stringify(memories, null, 2))
    
    return NextResponse.json({
      success: true,
      memory: newMemory,
      total: memories.length
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to store memory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
