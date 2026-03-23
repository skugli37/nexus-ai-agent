/**
 * NEXUS API - Status Endpoint
 * Returns current agent state, metrics, memories, skills, and tools
 * NO DEFAULTS - All data loaded from filesystem
 */

import { NextResponse } from 'next/server';
import {
  getSystemMetrics,
  loadToolsFromFS,
  loadSkillsFromFS,
  loadMemoriesFromFS,
  loadAgentState,
  loadAgentMetrics
} from '@/lib/nexus-core';

export async function GET() {
  try {
    // Load all data in parallel
    const [systemMetrics, tools, skills, memories, state, metrics] = await Promise.all([
      getSystemMetrics(),
      loadToolsFromFS(),
      loadSkillsFromFS(),
      loadMemoriesFromFS(),
      Promise.resolve(loadAgentState()),
      Promise.resolve(loadAgentMetrics())
    ]);
    
    // Calculate memory stats from real data
    const byType: Record<string, number> = {};
    for (const memory of memories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
    }
    
    return NextResponse.json({
      state,
      metrics,
      memories: memories.slice(-20),
      memoryStats: {
        total: memories.length,
        byType
      },
      systemMetrics,
      skills,
      tools
    });
  } catch (error) {
    console.error('Status error:', error);
    
    // Return empty data on error - NO DEFAULTS
    return NextResponse.json({
      state: {
        status: 'error',
        phase: 'conscious',
        sessionId: null,
        lastActivity: new Date().toISOString()
      },
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageResponseTime: 0,
        totalTokensUsed: 0,
        dreamCyclesCompleted: 0,
        learningIterations: 0
      },
      memories: [],
      memoryStats: { total: 0, byType: {} },
      systemMetrics: {
        memoryUsage: 0,
        toolsCount: 0,
        skillsCount: 0,
        pipelinesCount: 0
      },
      skills: [],
      tools: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
