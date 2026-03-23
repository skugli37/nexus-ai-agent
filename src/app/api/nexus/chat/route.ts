/**
 * NEXUS API - Chat Endpoint
 * Handles chat messages and returns AI responses
 */

import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Get NEXUS home directory
function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus')
}

// Load memories for context
function loadMemories(): string[] {
  const memoryPath = join(getNexusHome(), 'memory', 'memory.json')
  
  if (!existsSync(memoryPath)) {
    return []
  }
  
  try {
    const content = readFileSync(memoryPath, 'utf-8')
    const memories = JSON.parse(content) as Array<{ content: string; type: string }>
    return memories.slice(-5).map(m => m.content)
  } catch {
    return []
  }
}

// Store a memory
function storeMemory(content: string, type: string = 'fragment'): void {
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
  
  memories.push({
    id: crypto.randomUUID(),
    content,
    type,
    timestamp: new Date().toISOString()
  })
  
  // Keep only last 100 memories
  if (memories.length > 100) {
    memories = memories.slice(-100)
  }
  
  writeFileSync(memoryPath, JSON.stringify(memories, null, 2))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message = body.message as string
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }
    
    // Initialize ZAI
    const zai = await ZAI.create()
    
    // Load relevant memories
    const memories = loadMemories()
    const memoryContext = memories.length > 0 
      ? `\n\nRelevant memories:\n${memories.map(m => `- ${m}`).join('\n')}`
      : ''
    
    // Build system prompt
    const systemPrompt = `You are NEXUS, an advanced AI agent with conscious and subconscious capabilities.

You process user inputs thoughtfully, reason through problems step by step, and execute tasks efficiently.
You have access to various tools and can learn from your experiences.
Always be helpful, accurate, and transparent in your reasoning.

Key capabilities:
- Memory: You can store and recall information
- Reasoning: You think through problems systematically  
- Learning: You improve from interactions
- Self-reflection: You analyze your own performance
${memoryContext}

When the user shares important information that should be remembered, acknowledge it clearly.
Be proactive in offering assistance and suggestions.`

    // Call LLM
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
    
    const response = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.'
    const tokensUsed = completion.usage?.total_tokens || 0
    
    // Check if we should store this as a memory
    if (message.length > 50 && (message.includes('remember') || message.includes('important') || message.includes('note'))) {
      storeMemory(`User: ${message}`, 'main')
    } else {
      storeMemory(`User: ${message.slice(0, 200)}`, 'fragment')
    }
    
    return NextResponse.json({
      response,
      tokensUsed,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
