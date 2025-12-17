import { NextRequest, NextResponse } from 'next/server';
import {
  executeInDaytona,
  listDaytonaWorkspaces,
  createDaytonaWorkspace,
  reproStepsToCommand
} from '../../../lib/daytonaClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workspaces = await listDaytonaWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: 'Failed to list workspaces',
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reproSteps, repositoryUrl, workspaceName } = body;

    if (!reproSteps || typeof reproSteps !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid reproSteps' },
        { status: 400 }
      );
    }

    // Step 1: Create a new Daytona workspace
    // eslint-disable-next-line no-console
    console.log('Creating Daytona workspace...');
    const workspace = await createDaytonaWorkspace({
      name: workspaceName || `qa-repro-${Date.now()}`,
      repositoryUrl: repositoryUrl || undefined
    });

    // eslint-disable-next-line no-console
    console.log(`Workspace created: ${workspace.id}`);

    // Step 2: Convert repro steps to an executable command
    const command = reproStepsToCommand(reproSteps);
    
    // Step 3: Execute the repro in the new workspace
    // eslint-disable-next-line no-console
    console.log(`Executing command in workspace ${workspace.id}: ${command}`);
    const result = await executeInDaytona(workspace.id, command);

    return NextResponse.json({
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      command,
      workspaceId: workspace.id,
      workspaceName: workspace.name || workspace.id
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

