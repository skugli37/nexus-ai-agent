/**
 * NEXUS API - Status Endpoint
 * Returns current agent state, metrics, memories, and skills
 */

import { NextResponse } from 'next/server'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Get NEXUS home directory
function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus')
}

// Get memory stats
function getMemoryStats(): { total: number; byType: Record<string, number>; memories: unknown[] } {
  const memoryPath = join(getNexusHome(), 'memory', 'memory.json')
  
  if (!existsSync(memoryPath)) {
    return { total: 0, byType: {}, memories: [] }
  }
  
  try {
    const content = readFileSync(memoryPath, 'utf-8')
    const memories = JSON.parse(content) as Array<{ type: string }>
    const byType: Record<string, number> = {}
    
    for (const memory of memories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1
    }
    
    return { 
      total: memories.length, 
      byType, 
      memories: memories.slice(-20) // Last 20 memories
    }
  } catch {
    return { total: 0, byType: {}, memories: [] }
  }
}

// Get skills
function getSkills(): Array<{ name: string; description: string; version: string; tags: string[] }> {
  const skillsPath = join(getNexusHome(), 'skills')
  
  if (!existsSync(skillsPath)) {
    return []
  }
  
  const skills: Array<{ name: string; description: string; version: string; tags: string[] }> = []
  
  try {
    const files = readdirSync(skillsPath, { recursive: true }) as string[]
    
    for (const file of files) {
      if (file.endsWith('.skill.md') || file.endsWith('.skill.json')) {
        try {
          const content = readFileSync(join(skillsPath, file), 'utf-8')
          
          if (file.endsWith('.skill.md')) {
            // Parse SKILL.md format
            const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
            const frontMatter: Record<string, string | string[]> = {}
            
            if (frontMatterMatch) {
              for (const line of frontMatterMatch[1].split('\n')) {
                const match = line.match(/^(\w+):\s*(.*)$/)
                if (match) {
                  const key = match[1]
                  const value = match[2].trim()
                  if (value.startsWith('[') && value.endsWith(']')) {
                    frontMatter[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''))
                  } else {
                    frontMatter[key] = value.replace(/['"]/g, '')
                  }
                }
              }
            }
            
            skills.push({
              name: (frontMatter.name as string) || file.replace('.skill.md', ''),
              description: (frontMatter.description as string) || '',
              version: (frontMatter.version as string) || '1.0.0',
              tags: (frontMatter.tags as string[]) || []
            })
          } else {
            const parsed = JSON.parse(content)
            skills.push({
              name: parsed.name || file.replace('.skill.json', ''),
              description: parsed.description || '',
              version: parsed.version || '1.0.0',
              tags: parsed.tags || []
            })
          }
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Skills directory doesn't exist or is inaccessible
  }
  
  return skills
}

export async function GET() {
  const memoryStats = getMemoryStats()
  const skills = getSkills()
  
  // Simulated agent state
  const state = {
    status: 'idle',
    phase: 'conscious',
    sessionId: null,
    lastActivity: new Date().toISOString()
  }
  
  // Simulated metrics
  const metrics = {
    tasksCompleted: Math.floor(Math.random() * 50),
    tasksFailed: Math.floor(Math.random() * 5),
    averageResponseTime: Math.random() * 500 + 200,
    totalTokensUsed: Math.floor(Math.random() * 50000),
    dreamCyclesCompleted: Math.floor(Math.random() * 10),
    learningIterations: Math.floor(Math.random() * 20)
  }
  
  return NextResponse.json({
    state,
    metrics,
    memories: memoryStats.memories,
    skills,
    memoryStats: {
      total: memoryStats.total,
      byType: memoryStats.byType
    }
  })
}
