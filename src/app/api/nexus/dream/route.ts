/**
 * NEXUS API - Dream Endpoint
 * Full implementation using Agent's dream cycle functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDreamCycle, memorize, getAgent } from '@/lib/nexus-bridge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deep, duration } = body;
    
    // Get agent to check state
    const agent = await getAgent();
    const state = agent.getState();
    
    if (state.status === 'dreaming') {
      return NextResponse.json(
        { error: 'Dream cycle already in progress' },
        { status: 409 }
      );
    }
    
    // Run dream cycle
    const result = await runDreamCycle();
    
    // Memorize dream results if significant
    if (result.insights && result.insights.length > 0) {
      await memorize(
        `Dream insights: ${result.insights.join('; ')}`,
        'solution'
      );
    }
    
    if (result.patterns && result.patterns.length > 0) {
      await memorize(
        `Dream patterns: ${result.patterns.join(', ')}`,
        'fragment'
      );
    }
    
    return NextResponse.json({
      success: true,
      dreamCycle: {
        id: result.id,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        duration: new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime(),
        memoriesProcessed: result.memoriesProcessed,
        toolsGenerated: result.toolsGenerated,
        patternsFound: result.patterns?.length || 0,
        insights: result.insights || [],
        optimizations: result.optimizations || [],
        patterns: result.patterns || []
      }
    });
  } catch (error) {
    console.error('Dream cycle error:', error);
    return NextResponse.json(
      { error: 'Dream cycle failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const agent = await getAgent();
  const state = agent.getState();
  const metrics = agent.getMetrics();
  
  return NextResponse.json({
    status: state.status === 'dreaming' ? 'running' : 'available',
    phase: state.phase,
    dreamCyclesCompleted: metrics.dreamCyclesCompleted,
    message: 'Dream cycle endpoint ready - POST to trigger a dream cycle'
  });
}
