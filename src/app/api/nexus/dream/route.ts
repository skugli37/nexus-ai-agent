/**
 * NEXUS API - Dream Cycle Endpoint
 * Triggers background processing for memory consolidation and learning
 */

import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Get NEXUS home directory
function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus')
}

// Load all memories
function loadAllMemories(): Array<{ id: string; content: string; type: string; timestamp: string }> {
  const memoryPath = join(getNexusHome(), 'memory', 'memory.json')
  
  if (!existsSync(memoryPath)) {
    return []
  }
  
  try {
    return JSON.parse(readFileSync(memoryPath, 'utf-8'))
  } catch {
    return []
  }
}

// Save memories
function saveMemories(memories: Array<{ id: string; content: string; type: string; timestamp: string }>): void {
  const memoryDir = join(getNexusHome(), 'memory')
  const memoryPath = join(memoryDir, 'memory.json')
  
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true })
  }
  
  writeFileSync(memoryPath, JSON.stringify(memories, null, 2))
}

export async function POST() {
  try {
    const zai = await ZAI.create()
    const memories = loadAllMemories()
    
    // Separate by type
    const fragments = memories.filter(m => m.type === 'fragment')
    const solutions = memories.filter(m => m.type === 'solution')
    const main = memories.filter(m => m.type === 'main')
    
    let patternsDiscovered = 0
    let improvementsGenerated = 0
    
    // Phase 1: Consolidate fragments into main memories
    if (fragments.length >= 3) {
      const fragmentContents = fragments.slice(-10).map(f => f.content).join('\n---\n')
      
      const consolidation = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a memory consolidation system. Analyze fragments and extract durable knowledge.
Create concise, well-structured main memory entries. Focus on:
- Key facts and patterns
- User preferences  
- Important relationships
- Problem-solving strategies

Output JSON array of 1-3 consolidated entries with "content" field.`
          },
          {
            role: 'user',
            content: fragmentContents
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
      
      const consolidated = consolidation.choices[0]?.message?.content || '[]'
      
      // Try to parse and store consolidated memories
      try {
        const parsed = JSON.parse(consolidated)
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (entry.content) {
              memories.push({
                id: crypto.randomUUID(),
                content: entry.content,
                type: 'main',
                timestamp: new Date().toISOString()
              })
            }
          }
          // Remove consolidated fragments
          const fragmentIds = new Set(fragments.slice(-10).map(f => f.id))
          const remaining = memories.filter(m => !fragmentIds.has(m.id))
          saveMemories(remaining)
        }
      } catch {
        // If JSON parsing fails, store raw
      }
    }
    
    // Phase 2: Pattern recognition from solutions
    if (solutions.length >= 2) {
      const solutionContents = solutions.map(s => s.content).join('\n---\n')
      
      const analysis = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a pattern analysis system. Analyze solutions and identify:
1. Common patterns
2. Reusable strategies
3. Potential improvements

Output concise markdown analysis.`
          },
          {
            role: 'user',
            content: solutionContents
          }
        ],
        temperature: 0.5,
        max_tokens: 1000
      })
      
      const analysisResult = analysis.choices[0]?.message?.content || ''
      
      if (analysisResult.length > 50) {
        memories.push({
          id: crypto.randomUUID(),
          content: `Dream Analysis: ${analysisResult.slice(0, 500)}`,
          type: 'solution',
          timestamp: new Date().toISOString()
        })
        patternsDiscovered = 1
        improvementsGenerated = analysisResult.split('\n').filter(l => l.includes('-') || l.includes('*')).length
      }
    }
    
    saveMemories(memories)
    
    return NextResponse.json({
      success: true,
      message: 'Dream cycle completed',
      stats: {
        fragmentsProcessed: fragments.length,
        solutionsAnalyzed: solutions.length,
        mainMemories: main.length,
        patternsDiscovered,
        improvementsGenerated
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Dream cycle error:', error)
    return NextResponse.json(
      { error: 'Dream cycle failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
