/**
 * NEXUS API - Skills Endpoint
 * CRUD operations for NEXUS skills
 * NO DEFAULTS - All skills loaded from filesystem
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { getNexusHome, loadSkillsFromFS, Skill } from '@/lib/nexus-core';

// Get all skills - NO DEFAULTS
export async function GET() {
  const skills = await loadSkillsFromFS();
  return NextResponse.json({ skills });
}

// Create/install new skill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, tags, action } = body;
    
    if (action === 'install') {
      // Install skill (would normally fetch from ClawHub)
      return NextResponse.json({
        success: false,
        error: 'ClawHub integration not yet configured'
      });
    }
    
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
    
    // Create skill directory and SKILL.md
    mkdirSync(skillDir, { recursive: true });
    
    const skillContent = `---
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
    
    const newSkill: Skill = {
      name,
      description: description || '',
      version: '1.0.0',
      tags: tags || [],
      installed: true,
      author: 'Local'
    };
    
    return NextResponse.json({
      success: true,
      skill: newSkill
    });
  } catch (error) {
    console.error('Failed to create skill:', error);
    return NextResponse.json(
      { error: 'Failed to create skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Delete/uninstall skill
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
      message: `Skill '${name}' uninstalled successfully`
    });
  } catch (error) {
    console.error('Failed to delete skill:', error);
    return NextResponse.json(
      { error: 'Failed to delete skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
