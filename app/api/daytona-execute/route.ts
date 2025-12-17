import { NextRequest, NextResponse } from 'next/server';
import { createSandboxAndExecute } from '../../../lib/daytona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reproSteps, sandboxName } = body;

    if (!reproSteps || typeof reproSteps !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid reproSteps' },
        { status: 400 }
      );
    }

    // Check if Daytona is configured
    if (!process.env.DAYTONA_API_KEY) {
      return NextResponse.json(
        {
          error: 'Daytona not configured',
          details: 'DAYTONA_API_KEY is not set in environment variables'
        },
        { status: 500 }
      );
    }

    // Create sandbox and execute
    const result = await createSandboxAndExecute(reproSteps, sandboxName);

    return NextResponse.json({
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      command: result.command,
      sandboxId: result.sandboxId,
      sandboxName: result.sandboxName
    });
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('Error in /api/daytona-execute:', err);
    return NextResponse.json(
      {
        error: 'Daytona execution failed',
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}
