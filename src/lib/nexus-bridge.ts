/**
 * NEXUS Core Bridge
 * Connects Next.js API routes to NEXUS core modules
 * 
 * This is the REAL integration - not just filesystem reads!
 */

import { existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ============================================================================
// CORE MODULE IMPORTS
// ============================================================================

// Import real core modules
import { Agent } from '../nexus/core/agent';
import { VectorStore } from '../nexus/core/vector-store';
import { ToolForge } from '../nexus/core/tool-forge';
import { CodeSandbox } from '../nexus/core/sandbox';
import { Conscious } from '../nexus/core/conscious';
import { Subconscious } from '../nexus/core/subconscious';

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

let agentInstance: Agent | null = null;
let vectorStoreInstance: VectorStore | null = null;
let toolForgeInstance: ToolForge | null = null;
let sandboxInstance: CodeSandbox | null = null;

// ============================================================================
// NEXUS HOME
// ============================================================================

export function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus');
}

// ============================================================================
// AGENT INSTANCE
// ============================================================================

export async function getAgent(): Promise<Agent> {
  if (!agentInstance) {
    agentInstance = new Agent({
      id: 'nexus-web-agent',
      name: 'NEXUS Web Agent',
      autoStartDreamCycles: false // Disabled for web mode
    });
    await agentInstance.initialize();
  }
  return agentInstance;
}

// ============================================================================
// VECTOR STORE INSTANCE
// ============================================================================

export async function getVectorStore(): Promise<VectorStore> {
  if (!vectorStoreInstance) {
    const storePath = join(getNexusHome(), 'memory', 'vectors.json');
    vectorStoreInstance = new VectorStore(storePath);
    await vectorStoreInstance.load();
  }
  return vectorStoreInstance;
}

// ============================================================================
// TOOL FORGE INSTANCE
// ============================================================================

export async function getToolForge(): Promise<ToolForge> {
  if (!toolForgeInstance) {
    toolForgeInstance = new ToolForge({
      outputDir: join(getNexusHome(), 'tools')
    });
  }
  return toolForgeInstance;
}

// ============================================================================
// CODE SANDBOX INSTANCE
// ============================================================================

export async function getSandbox(): Promise<CodeSandbox> {
  if (!sandboxInstance) {
    sandboxInstance = new CodeSandbox();
  }
  return sandboxInstance;
}

// ============================================================================
// SYSTEM METRICS (REAL DATA)
// ============================================================================

export interface SystemMetrics {
  memoryUsage: number;
  toolsCount: number;
  skillsCount: number;
  pipelinesCount: number;
  uptime: number;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const nexusHome = getNexusHome();
  
  // Real memory usage
  const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
  
  // Count tools from filesystem
  const toolsDir = join(nexusHome, 'tools');
  let toolsCount = 0;
  try {
    if (existsSync(toolsDir)) {
      const files = readdirSync(toolsDir, { recursive: true }) as string[];
      toolsCount = files.filter(f => f.endsWith('.ts') || f.endsWith('.js')).length;
    }
  } catch {}
  
  // Count skills
  const skillsDir = join(nexusHome, 'skills');
  let skillsCount = 0;
  try {
    if (existsSync(skillsDir)) {
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      skillsCount = entries.filter(d => d.isDirectory()).length;
    }
  } catch {}
  
  // Count pipelines
  const pipelinesDir = join(nexusHome, 'pipelines');
  let pipelinesCount = 0;
  try {
    if (existsSync(pipelinesDir)) {
      const files = readdirSync(pipelinesDir);
      pipelinesCount = files.filter(f => f.endsWith('.json')).length;
    }
  } catch {}
  
  return {
    memoryUsage: Math.round(memoryUsage),
    toolsCount,
    skillsCount,
    pipelinesCount,
    uptime: process.uptime()
  };
}

// ============================================================================
// MEMORY OPERATIONS (USING REAL VECTOR STORE)
// ============================================================================

export interface Memory {
  id: string;
  content: string;
  type: 'main' | 'fragment' | 'solution';
  timestamp: string;
  importance?: number;
  tags?: string[];
}

export async function memorize(content: string, type: Memory['type'] = 'fragment'): Promise<Memory> {
  const vectorStore = await getVectorStore();
  const id = crypto.randomUUID();
  const memory: Memory = {
    id,
    content,
    type,
    timestamp: new Date().toISOString(),
    importance: 0.5,
    tags: []
  };
  
  // Store in vector store
  await vectorStore.add({
    id,
    content,
    metadata: { type, timestamp: memory.timestamp }
  });
  
  // Also save to file for persistence
  const memoryPath = join(getNexusHome(), 'memory', 'memory.json');
  let memories: Memory[] = [];
  
  try {
    if (existsSync(memoryPath)) {
      memories = JSON.parse(readFileSync(memoryPath, 'utf-8'));
    }
  } catch {}
  
  memories.push(memory);
  
  // Keep only last 1000 memories
  if (memories.length > 1000) {
    memories = memories.slice(-1000);
  }
  
  mkdirSync(join(getNexusHome(), 'memory'), { recursive: true });
  writeFileSync(memoryPath, JSON.stringify(memories, null, 2));
  
  return memory;
}

export async function recall(query: string, limit: number = 10): Promise<Memory[]> {
  const vectorStore = await getVectorStore();
  
  // Search using vector similarity
  const results = await vectorStore.search(query, limit);
  
  return results.map(r => ({
    id: r.id,
    content: r.content,
    type: (r.metadata?.type as Memory['type']) || 'fragment',
    timestamp: r.metadata?.timestamp || new Date().toISOString(),
    importance: r.score
  }));
}

export async function getAllMemories(): Promise<Memory[]> {
  const memoryPath = join(getNexusHome(), 'memory', 'memory.json');
  
  if (!existsSync(memoryPath)) {
    return [];
  }
  
  try {
    return JSON.parse(readFileSync(memoryPath, 'utf-8'));
  } catch {
    return [];
  }
}

// ============================================================================
// TOOL OPERATIONS (USING REAL TOOL FORGE)
// ============================================================================

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  enabled: boolean;
  usageCount: number;
  createdAt?: string;
}

export async function createTool(name: string, description: string, code: string): Promise<Tool> {
  const toolForge = await getToolForge();
  
  // Generate tool using ToolForge
  const result = await toolForge.generateTool({
    name,
    description,
    category: 'custom',
    requirements: [],
    inputSchema: {}
  });
  
  // Save to tools directory
  const toolsDir = join(getNexusHome(), 'tools');
  mkdirSync(toolsDir, { recursive: true });
  
  const toolPath = join(toolsDir, `${name.toLowerCase().replace(/\s+/g, '_')}.ts`);
  writeFileSync(toolPath, code || result.code);
  
  return {
    id: crypto.randomUUID(),
    name,
    description,
    category: 'custom',
    parameters: [],
    enabled: true,
    usageCount: 0,
    createdAt: new Date().toISOString()
  };
}

export async function listTools(): Promise<Tool[]> {
  const toolsDir = join(getNexusHome(), 'tools');
  const tools: Tool[] = [];
  
  if (!existsSync(toolsDir)) {
    return tools;
  }
  
  const files = readdirSync(toolsDir, { recursive: true }) as string[];
  
  for (const file of files) {
    if (file.endsWith('.ts') || file.endsWith('.js')) {
      const toolId = file.replace(/\.(ts|js)$/, '');
      tools.push({
        id: toolId,
        name: toolId,
        description: `Custom tool: ${toolId}`,
        category: 'custom',
        parameters: [],
        enabled: true,
        usageCount: 0
      });
    }
  }
  
  return tools;
}

// ============================================================================
// SKILL OPERATIONS
// ============================================================================

export interface Skill {
  name: string;
  description: string;
  version: string;
  tags: string[];
  installed: boolean;
  author?: string;
}

export async function listSkills(): Promise<Skill[]> {
  const skillsDir = join(getNexusHome(), 'skills');
  const skills: Skill[] = [];
  
  if (!existsSync(skillsDir)) {
    return skills;
  }
  
  const dirs = readdirSync(skillsDir, { withFileTypes: true });
  
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    
    const skillPath = join(skillsDir, dir.name, 'SKILL.md');
    if (existsSync(skillPath)) {
      try {
        const content = readFileSync(skillPath, 'utf-8');
        const frontMatter = content.match(/^---\n([\s\S]*?)\n---/);
        
        let name = dir.name;
        let description = '';
        let version = '1.0.0';
        let tags: string[] = [];
        
        if (frontMatter) {
          for (const line of frontMatter[1].split('\n')) {
            const match = line.match(/^(\w+):\s*(.*)$/);
            if (match) {
              const key = match[1];
              const value = match[2].trim().replace(/['"]/g, '');
              if (key === 'name') name = value;
              if (key === 'description') description = value;
              if (key === 'version') version = value;
              if (key === 'tags') {
                tags = value.slice(1, -1).split(',').map(t => t.trim());
              }
            }
          }
        }
        
        skills.push({
          name,
          description,
          version,
          tags,
          installed: true,
          author: 'Local'
        });
      } catch {}
    }
  }
  
  return skills;
}

// ============================================================================
// INITIALIZE DIRECTORIES
// ============================================================================

export function initializeNexusDirectories(): void {
  const nexusHome = getNexusHome();
  const directories = [
    nexusHome,
    join(nexusHome, 'tools'),
    join(nexusHome, 'skills'),
    join(nexusHome, 'memory'),
    join(nexusHome, 'config'),
    join(nexusHome, 'pipelines'),
    join(nexusHome, 'logs')
  ];
  
  for (const dir of directories) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// Initialize on import
initializeNexusDirectories();
