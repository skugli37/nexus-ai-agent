/**
 * NEXUS API - Dream Endpoint
 * Uses REAL Subconscious module for dream cycles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgent, memorize } from '@/lib/nexus-bridge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deep, duration } = body;
    
    // Get REAL agent
    const agent = await getAgent();
    
    // Trigger dream cycle through agent's subconscious
    const result = await agent.runDreamCycle({
      deep: deep === true,
      duration: duration || 60000
    });
    
    // Memorize dream results
    if (result.patterns && result.patterns.length > 0) {
      await memorize(`Dream patterns: ${result.patterns.join(', ')}`, 'main');
    }
    
    return NextResponse.json({
      success: true,
      dreamCycle: {
        id: crypto.randomUUID(),
        duration: result.duration || 0,
        patternsFound: result.patterns?.length || 0,
        memoriesConsolidated: result.consolidated || 0,
        insights: result.insights || [],
        timestamp: new Date().toISOString()
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
  return NextResponse.json({
    status: 'available',
    message: 'Dream cycle endpoint ready'
  });
}
