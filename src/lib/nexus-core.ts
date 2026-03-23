/**
 * NEXUS Core Bridge
 * Connects Next.js API routes to NEXUS core modules
 */

import { existsSync, readdirSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Get NEXUS home directory
export function getNexusHome(): string {
  return process.env.NEXUS_HOME || join(homedir(), '.nexus');
}

// System metrics interface
export interface SystemMetrics {
  memoryUsage: number;
  toolsCount: number;
  skillsCount: number;
  pipelinesCount: number;
}

// Get real system metrics
export async function getSystemMetrics(): Promise<SystemMetrics> {
  // Real memory usage from process
  const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
  
  // Count real tools from nexus/tools directory
  const nexusHome = getNexusHome();
  const toolsDir = join(nexusHome, 'tools');
  let toolsCount = 0;
  
  try {
    if (existsSync(toolsDir)) {
      const files = readdirSync(toolsDir, { recursive: true }) as string[];
      toolsCount = files.filter(f => 
        f.endsWith('.tool.ts') || f.endsWith('.tool.js') || f.endsWith('.ts')
      ).length;
    }
  } catch {
    // Directory doesn't exist
  }
  
  // Count real skills
  const skillsDir = join(nexusHome, 'skills');
  let skillsCount = 0;
  
  try {
    if (existsSync(skillsDir)) {
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      skillsCount = entries.filter(d => d.isDirectory()).length;
    }
  } catch {
    // Directory doesn't exist
  }
  
  // Count pipelines
  const pipelinesDir = join(nexusHome, 'pipelines');
  let pipelinesCount = 0;
  
  try {
    if (existsSync(pipelinesDir)) {
      const files = readdirSync(pipelinesDir);
      pipelinesCount = files.filter(f => f.endsWith('.json') || f.endsWith('.yaml')).length;
    }
  } catch {
    // Directory doesn't exist
  }
  
  return {
    memoryUsage: Math.round(memoryUsage),
    toolsCount,
    skillsCount,
    pipelinesCount
  };
}

// Initialize NEXUS directories
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

// Tool interface
export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
  }>;
  enabled: boolean;
  lastUsed?: string;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

// Load tools from filesystem - NO DEFAULTS
export async function loadToolsFromFS(): Promise<Tool[]> {
  const nexusHome = getNexusHome();
  const toolsDir = join(nexusHome, 'tools');
  const tools: Tool[] = [];
  
  if (!existsSync(toolsDir)) {
    return tools; // Return empty array, NO DEFAULTS
  }
  
  const files = readdirSync(toolsDir, { recursive: true }) as string[];
  
  for (const file of files) {
    if (file.endsWith('.ts') || file.endsWith('.js')) {
      const toolId = file.replace(/\.(ts|js)$/, '');
      
      tools.push({
        id: toolId,
        name: toolId,
        description: `Tool: ${toolId}`,
        category: 'custom',
        parameters: [],
        enabled: true,
        usageCount: 0
      });
    }
  }
  
  return tools;
}

// Skill interface
export interface Skill {
  name: string;
  description: string;
  version: string;
  tags: string[];
  installed: boolean;
  author?: string;
}

// Load skills from filesystem - NO DEFAULTS
export async function loadSkillsFromFS(): Promise<Skill[]> {
  const nexusHome = getNexusHome();
  const skillsDir = join(nexusHome, 'skills');
  const skills: Skill[] = [];
  
  if (!existsSync(skillsDir)) {
    return skills; // Return empty array, NO DEFAULTS
  }
  
  const dirs = readdirSync(skillsDir, { withFileTypes: true });
  
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    
    skills.push({
      name: dir.name,
      description: `Skill: ${dir.name}`,
      version: '1.0.0',
      tags: [],
      installed: true,
      author: 'Local'
    });
  }
  
  return skills;
}

// Memory interface
export interface Memory {
  id: string;
  content: string;
  type: 'main' | 'fragment' | 'solution';
  timestamp: string;
  importance?: number;
  tags?: string[];
}

// Load memories from filesystem
export async function loadMemoriesFromFS(): Promise<Memory[]> {
  const nexusHome = getNexusHome();
  const memoryPath = join(nexusHome, 'memory', 'memory.json');
  
  if (!existsSync(memoryPath)) {
    return [];
  }
  
  try {
    const content = await import('fs').then(fs => fs.readFileSync(memoryPath, 'utf-8'));
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Agent state interface
export interface AgentState {
  status: 'idle' | 'processing' | 'dreaming' | 'reflecting' | 'learning' | 'error';
  phase: 'conscious' | 'subconscious';
  sessionId: string | null;
  lastActivity: string;
}

// Load agent state
export function loadAgentState(): AgentState {
  const nexusHome = getNexusHome();
  const statePath = join(nexusHome, 'config', 'agent-state.json');
  
  if (!existsSync(statePath)) {
    return {
      status: 'idle',
      phase: 'conscious',
      sessionId: null,
      lastActivity: new Date().toISOString()
    };
  }
  
  try {
    const content = readFileSync(statePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      status: 'idle',
      phase: 'conscious',
      sessionId: null,
      lastActivity: new Date().toISOString()
    };
  }
}

// Agent metrics interface
export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  dreamCyclesCompleted: number;
  learningIterations: number;
}

// Load agent metrics
export function loadAgentMetrics(): AgentMetrics {
  const nexusHome = getNexusHome();
  const metricsPath = join(nexusHome, 'config', 'metrics.json');
  
  if (!existsSync(metricsPath)) {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      dreamCyclesCompleted: 0,
      learningIterations: 0
    };
  }
  
  try {
    const content = readFileSync(metricsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      dreamCyclesCompleted: 0,
      learningIterations: 0
    };
  }
}

// Initialize on import
initializeNexusDirectories();
