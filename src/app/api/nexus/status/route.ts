/**
 * NEXUS API - Status Endpoint
 * Full implementation using REAL agent and core modules
 */

import { NextResponse } from 'next/server';
import {
  getAgent,
  getSystemMetrics,
  listTools,
  listSkills,
  getAllMemories,
  getConfig
} from '@/lib/nexus-bridge';

export async function GET() {
  try {
    // Get REAL agent instance
    const agent = await getAgent();
    const state = agent.getState();
    const metrics = agent.getMetrics();
    
    // Get all data in parallel
    const [systemMetrics, tools, skills, memories, config] = await Promise.all([
      getSystemMetrics(),
      listTools(),
      listSkills(),
      getAllMemories(),
      getConfig()
    ]);
    
    // Calculate memory stats
    const memoryByType: Record<string, number> = {};
    for (const memory of memories) {
      memoryByType[memory.type] = (memoryByType[memory.type] || 0) + 1;
    }
    
    return NextResponse.json({
      state: {
        id: state.id,
        name: state.name,
        status: state.status,
        phase: state.phase,
        sessionId: state.sessionId,
        lastActivity: state.lastActivity?.toISOString() || new Date().toISOString(),
        createdAt: state.createdAt?.toISOString()
      },
      metrics: {
        tasksCompleted: metrics.tasksCompleted,
        tasksFailed: metrics.tasksFailed,
        averageResponseTime: metrics.averageResponseTime,
        totalTokensUsed: metrics.totalTokensUsed,
        dreamCyclesCompleted: metrics.dreamCyclesCompleted,
        learningIterations: metrics.learningIterations,
        toolsUsed: metrics.toolsUsed,
        skillsExecuted: metrics.skillsExecuted
      },
      memories: memories.slice(-20),
      memoryStats: {
        total: memories.length,
        byType: memoryByType
      },
      systemMetrics,
      skills,
      tools,
      config: {
        agentId: config.agentId,
        agentName: config.agentName,
        primaryModel: config.primaryModel,
        utilityModel: config.utilityModel,
        dreamCycleInterval: config.dreamCycleInterval,
        memoryLimit: config.memoryLimit,
        enableLearning: config.enableLearning,
        enableSelfModification: config.enableSelfModification
      }
    });
  } catch (error) {
    console.error('Status error:', error);
    
    return NextResponse.json({
      state: {
        id: 'nexus-error',
        name: 'NEXUS',
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
        learningIterations: 0,
        toolsUsed: 0,
        skillsExecuted: 0
      },
      memories: [],
      memoryStats: { total: 0, byType: {} },
      systemMetrics: {
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        toolsCount: 0,
        skillsCount: 0,
        pipelinesCount: 0,
        uptime: process.uptime(),
        status: 'degraded'
      },
      skills: [],
      tools: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
