import { NextRequest, NextResponse } from 'next/server';
import { runQaAgent } from '../../../lib/orchestrator';

// Ensure this route runs in a Node.js runtime where process.env is available.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stackTrace = typeof body?.stackTrace === 'string' ? body.stackTrace : '';

    if (!stackTrace.trim()) {
      return NextResponse.json(
        { error: 'Missing stackTrace in request body' },
        { status: 400 }
      );
    }

    // Ensure OPENAI_API_KEY is available from environment
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'OPENAI_API_KEY not configured',
          details: 'Please set OPENAI_API_KEY in .env.local and restart the dev server'
        },
        { status: 500 }
      );
    }

    const result = await runQaAgent(stackTrace);

    return NextResponse.json(result);
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('Error in /api/analyze:', err);
    return NextResponse.json(
      {
        error: 'Agent run failed',
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}


