/**
 * NEXUS API - Skills Endpoint
 * CRUD operations for NEXUS skills
 */

import { NextRequest, NextResponse } from 'next/server'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Get NEXUS home directory
function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus')
}

// Get skills directory
function getSkillsDir(): string {
  return join(getNexusHome(), 'skills')
}

// Skill interface
interface Skill {
  name: string
  description: string
  version: string
  tags: string[]
  content?: string
  installed: boolean
  createdAt?: string
  updatedAt?: string
}

// Parse SKILL.md file
function parseSkillFile(content: string, filename: string): Skill {
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
  
  // Extract content after front matter
  const skillContent = frontMatterMatch ? content.slice(frontMatterMatch[0].length).trim() : content
  
  return {
    name: (frontMatter.name as string) || filename.replace('.skill.md', '').replace('.md', ''),
    description: (frontMatter.description as string) || '',
    version: (frontMatter.version as string) || '1.0.0',
    tags: (frontMatter.tags as string[]) || [],
    content: skillContent,
    installed: true
  }
}

// Get all skills
export async function GET() {
  const skillsDir = getSkillsDir()
  const skills: Skill[] = []
  
  if (!existsSync(skillsDir)) {
    return NextResponse.json({ skills: [] })
  }
  
  try {
    const files = readdirSync(skillsDir, { recursive: true }) as string[]
    
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.skill.md')) {
        try {
          const filePath = join(skillsDir, file)
          const content = readFileSync(filePath, 'utf-8')
          const skill = parseSkillFile(content, file)
          skills.push(skill)
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch (error) {
    console.error('Failed to read skills directory:', error)
  }
  
  return NextResponse.json({ skills })
}

// Create new skill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, version, tags, content, action } = body
    
    // Handle install/uninstall actions
    if (action === 'install') {
      // Mark as installed (in a real implementation, this would download the skill)
      return NextResponse.json({ 
        success: true, 
        message: `Skill '${name}' installed successfully` 
      })
    }
    
    if (action === 'uninstall') {
      const skillsDir = getSkillsDir()
      const skillPath = join(skillsDir, `${name}.skill.md`)
      
      if (existsSync(skillPath)) {
        unlinkSync(skillPath)
        return NextResponse.json({ 
          success: true, 
          message: `Skill '${name}' uninstalled successfully` 
        })
      }
      return NextResponse.json({ 
        success: false, 
        message: `Skill '${name}' not found` 
      }, { status: 404 })
    }
    
    // Create new skill
    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      )
    }
    
    const skillsDir = getSkillsDir()
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true })
    }
    
    // Create SKILL.md format
    const skillContent = `---
name: "${name}"
description: "${description || ''}"
version: "${version || '1.0.0'}"
tags: [${(tags || []).map((t: string) => `"${t}"`).join(', ')}]
---

${content}
`
    
    const skillPath = join(skillsDir, `${name}.skill.md`)
    writeFileSync(skillPath, skillContent)
    
    return NextResponse.json({
      success: true,
      skill: {
        name,
        description: description || '',
        version: version || '1.0.0',
        tags: tags || [],
        installed: true,
        createdAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Failed to create skill:', error)
    return NextResponse.json(
      { error: 'Failed to create skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Update skill
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, version, tags, content } = body
    
    if (!name) {
      return NextResponse.json(
        { error: 'Skill name is required' },
        { status: 400 }
      )
    }
    
    const skillsDir = getSkillsDir()
    const skillPath = join(skillsDir, `${name}.skill.md`)
    
    if (!existsSync(skillPath)) {
      return NextResponse.json(
        { error: `Skill '${name}' not found` },
        { status: 404 }
      )
    }
    
    // Read existing skill
    const existingContent = readFileSync(skillPath, 'utf-8')
    const existing = parseSkillFile(existingContent, `${name}.skill.md`)
    
    // Merge updates
    const updated = {
      ...existing,
      description: description || existing.description,
      version: version || existing.version,
      tags: tags || existing.tags,
      content: content || existing.content
    }
    
    // Write updated skill
    const skillContent = `---
name: "${updated.name}"
description: "${updated.description}"
version: "${updated.version}"
tags: [${updated.tags.map(t => `"${t}"`).join(', ')}]
---

${updated.content}
`
    
    writeFileSync(skillPath, skillContent)
    
    return NextResponse.json({
      success: true,
      skill: {
        ...updated,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Failed to update skill:', error)
    return NextResponse.json(
      { error: 'Failed to update skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Delete skill
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body
    
    if (!name) {
      return NextResponse.json(
        { error: 'Skill name is required' },
        { status: 400 }
      )
    }
    
    const skillsDir = getSkillsDir()
    const skillPath = join(skillsDir, `${name}.skill.md`)
    
    if (!existsSync(skillPath)) {
      return NextResponse.json(
        { error: `Skill '${name}' not found` },
        { status: 404 }
      )
    }
    
    unlinkSync(skillPath)
    
    return NextResponse.json({
      success: true,
      message: `Skill '${name}' deleted successfully`
    })
  } catch (error) {
    console.error('Failed to delete skill:', error)
    return NextResponse.json(
      { error: 'Failed to delete skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
