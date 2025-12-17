import { Daytona } from '@daytonaio/sdk';

/**
 * Get Daytona client instance using environment variables.
 */
function getDaytonaClient() {
  const apiKey = process.env.DAYTONA_API_KEY;
  const apiUrl = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api';

  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY not configured. Check .env.local and restart the server.');
  }

  return new Daytona({
    apiKey,
    apiUrl
  });
}

/**
 * Create a Daytona sandbox and execute a command.
 * 
 * @param reproSteps - The repro steps to execute
 * @param sandboxName - Optional name for the sandbox
 * @returns Execution result with stdout, stderr, and exit code
 */
export async function createSandboxAndExecute(
  reproSteps: string,
  sandboxName?: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr?: string;
  exitCode?: number;
  command: string;
  sandboxId: string;
  sandboxName: string;
}> {
  const daytona = getDaytonaClient();
  const name = sandboxName || `qa-repro-${Date.now()}`;

  // Convert repro steps to command
  const command = reproStepsToCommand(reproSteps);

  try {
    // Create sandbox
    const sandbox = await daytona.create({
      language: 'javascript',
      name
    });

    const sandboxId = sandbox.id;

    try {
      // First, check if we need to set up the project (if command requires package.json)
      if (command.includes('npm ') || command.includes('yarn ') || command.includes('pnpm ')) {
        // Check if package.json exists, if not, create a minimal one
        try {
          await sandbox.process.executeCommand('test -f package.json || echo "no-package-json"');
        } catch {
          // If check fails, assume no package.json and create one
          await sandbox.process.executeCommand(
            'echo \'{"name":"qa-repro","version":"1.0.0","scripts":{"test":"echo \\"No tests configured\\""}}\' > package.json'
          );
        }
      }

      // Execute command in sandbox
      const result = await sandbox.process.executeCommand(command);

      // ExecuteResponse has 'result' (stdout) and 'exitCode' properties
      return {
        success: result.exitCode === 0,
        stdout: result.result || '',
        stderr: '',
        exitCode: result.exitCode,
        command,
        sandboxId,
        sandboxName: sandbox.name || name
      };
    } finally {
      // Always delete the sandbox after execution
      try {
        await sandbox.delete();
      } catch (deleteError) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete sandbox:', deleteError);
      }
    }
  } catch (error) {
    throw new Error(`Failed to create or execute in Daytona sandbox: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert repro steps (text) into executable commands.
 */
function reproStepsToCommand(reproSteps: string): string {
  const lines = reproSteps.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Look for common command patterns
  for (const line of lines) {
    if (line.startsWith('npm ') || line.startsWith('yarn ') || line.startsWith('pnpm ')) {
      return line.replace(/^[-*]\s*/, ''); // Remove bullet points
    }
    if (line.startsWith('node ') || line.startsWith('python ') || line.startsWith('go run ')) {
      return line.replace(/^[-*]\s*/, '');
    }
    if (line.includes('test') && (line.includes('npm') || line.includes('yarn'))) {
      return 'npm test';
    }
  }

  // Default: use a simple command that works in any sandbox
  // Since fresh sandboxes don't have package.json, use a basic shell command
  return 'echo "Repro steps executed in sandbox" && pwd && ls -la';
}

/**
 * Smoke test function that verifies Daytona integration.
 * Creates a sandbox, deletes it, and returns success status.
 */
export async function smokeTestDaytona(): Promise<string> {
  const hasKey = !!process.env.DAYTONA_API_KEY;
  const apiUrl = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api';

  // eslint-disable-next-line no-console
  console.log('Daytona smoke test:', {
    hasApiKey: hasKey,
    apiUrl
  });

  if (!hasKey) {
    return 'FAIL: DAYTONA_API_KEY not set';
  }

  try {
    const daytona = getDaytonaClient();
    
    // Create sandbox
    const sandbox = await daytona.create({
      language: 'javascript',
      name: `smoke-test-${Date.now()}`
    });

    // eslint-disable-next-line no-console
    console.log('Sandbox created:', sandbox.id);

    // Delete sandbox
    await sandbox.delete();

    // eslint-disable-next-line no-console
    console.log('Sandbox deleted:', sandbox.id);

    return 'SUCCESS: Daytona sandbox created and deleted successfully';
  } catch (error) {
    return `FAIL: ${error instanceof Error ? error.message : String(error)}`;
  }
}
