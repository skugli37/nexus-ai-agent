/**
 * NEXUS API - Skills Endpoint
 * Uses REAL skill files from filesystem
 */

import { NextRequest, NextResponse } from 'next/server';
import { listSkills } from '@/lib/nexus-bridge';
import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { getNexusHome } from '@/lib/nexus-bridge';

// List all skills
export async function GET() {
  try {
    const skills = await listSkills();
    return NextResponse.json({ skills });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list skills' },
      { status: 500 }
    );
  }
}

// Create new skill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, tags, content } = body;
    
    if (!name) {
      return NextResponse.json(
        { error: 'Skill name is required' },
        { status: 400 }
      );
    }
    
    const skillsDir = join(getNexusHome(), 'skills');
    const skillDir = join(skillsDir, name.toLowerCase().replace(/\s+/g, '-'));
    
    if (existsSync(skillDir)) {
      return NextResponse.json(
        { error: `Skill '${name}' already exists` },
        { status: 409 }
      );
    }
    
    // Create skill directory
    mkdirSync(skillDir, { recursive: true });
    
    // Create SKILL.md file
    const skillContent = content || `---
name: ${name}
description: ${description || 'Custom skill'}
version: 1.0.0
tags: [${(tags || []).map((t: string) => `'${t}'`).join(', ')}]
author: Local
created: ${new Date().toISOString()}
---

# ${name}

${description || 'Custom skill for NEXUS agent.'}

## Usage

This skill can be invoked by the agent when the task matches its capabilities.

## Parameters

None defined.

## Examples

\`\`\`
Use ${name} to accomplish the task.
\`\`\`
`;
    
    writeFileSync(join(skillDir, 'SKILL.md'), skillContent);
    
    return NextResponse.json({
      success: true,
      skill: {
        name,
        description: description || '',
        version: '1.0.0',
        tags: tags || [],
        installed: true,
        author: 'Local'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Delete skill
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;
    
    if (!name) {
      return NextResponse.json(
        { error: 'Skill name is required' },
        { status: 400 }
      );
    }
    
    const skillsDir = join(getNexusHome(), 'skills');
    const skillDir = join(skillsDir, name.toLowerCase().replace(/\s+/g, '-'));
    
    if (!existsSync(skillDir)) {
      return NextResponse.json(
        { error: `Skill '${name}' not found` },
        { status: 404 }
      );
    }
    
    // Remove skill directory
    rmSync(skillDir, { recursive: true, force: true });
    
    return NextResponse.json({
      success: true,
      message: `Skill '${name}' uninstalled`
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete skill' },
      { status: 500 }
    );
  }
}
