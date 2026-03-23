/**
 * NEXUS API - Status Endpoint
 * Returns REAL agent state using REAL core modules
 */

import { NextResponse } from 'next/server';
import {
  getAgent,
  getSystemMetrics,
  listTools,
  listSkills,
  getAllMemories
} from '@/lib/nexus-bridge';

export async function GET() {
  try {
    // Get REAL agent
    const agent = await getAgent();
    const state = agent.getState();
    
    // Get REAL metrics
    const metrics = state.metrics;
    
    // Get REAL system metrics
    const systemMetrics = await getSystemMetrics();
    
    // Get REAL tools
    const tools = await listTools();
    
    // Get REAL skills
    const skills = await listSkills();
    
    // Get REAL memories
    const memories = await getAllMemories();
    
    // Calculate memory stats
    const memoryByType: Record<string, number> = {};
    for (const memory of memories) {
      memoryByType[memory.type] = (memoryByType[memory.type] || 0) + 1;
    }
    
    return NextResponse.json({
      state: {
        status: state.status,
        phase: state.phase,
        sessionId: state.sessionId,
        lastActivity: state.lastActivity?.toISOString() || new Date().toISOString()
      },
      metrics: {
        tasksCompleted: metrics?.tasksCompleted || 0,
        tasksFailed: metrics?.tasksFailed || 0,
        averageResponseTime: metrics?.averageResponseTime || 0,
        totalTokensUsed: metrics?.totalTokensUsed || 0,
        dreamCyclesCompleted: metrics?.dreamCyclesCompleted || 0,
        learningIterations: metrics?.learningIterations || 0
      },
      memories: memories.slice(-20),
      memoryStats: {
        total: memories.length,
        byType: memoryByType
      },
      systemMetrics,
      skills,
      tools
    });
  } catch (error) {
    console.error('Status error:', error);
    
    // Return partial data on error
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
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        toolsCount: 0,
        skillsCount: 0,
        pipelinesCount: 0,
        uptime: process.uptime()
      },
      skills: [],
      tools: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
