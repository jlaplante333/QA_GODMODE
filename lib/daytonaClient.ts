/**
 * Daytona API client for executing repro steps in a real workspace.
 * 
 * This is a minimal client that can:
 * - List workspaces
 * - Execute commands in a workspace
 * - Get execution results
 */

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY;
const DAYTONA_SERVER_URL = process.env.DAYTONA_SERVER_URL || 'https://app.daytona.io/api';

if (!DAYTONA_API_KEY) {
  throw new Error('DAYTONA_API_KEY not configured');
}

interface DaytonaWorkspace {
  id: string;
  name: string;
  project: {
    name: string;
    repository: {
      url: string;
    };
  };
  status?: string;
}

interface CreateWorkspaceRequest {
  name?: string;
  projectName?: string;
  repositoryUrl?: string;
  template?: string;
}

interface DaytonaExecuteResult {
  success: boolean;
  stdout: string;
  stderr?: string;
  exitCode?: number;
}

/**
 * Execute a command in a Daytona workspace.
 * 
 * @param workspaceId - The ID of the workspace to execute in
 * @param command - The command to execute (e.g., "npm test" or a script path)
 * @returns Execution result with stdout, stderr, and exit code
 */
export async function executeInDaytona(
  workspaceId: string,
  command: string
): Promise<DaytonaExecuteResult> {
  const url = `${DAYTONA_SERVER_URL}/workspaces/${workspaceId}/exec`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAYTONA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: command
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Daytona API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    return {
      success: data.exitCode === 0,
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      exitCode: data.exitCode
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Create a new Daytona workspace for reproducing the error.
 * 
 * @param options - Workspace creation options
 * @returns The created workspace
 */
export async function createDaytonaWorkspace(
  options: CreateWorkspaceRequest = {}
): Promise<DaytonaWorkspace> {
  const url = `${DAYTONA_SERVER_URL}/workspaces`;

  const workspaceName = options.name || `qa-repro-${Date.now()}`;
  const projectName = options.projectName || 'qa-repro';
  
  // Default to a minimal Node.js template if no repo is provided
  const repositoryUrl = options.repositoryUrl || 'https://github.com/daytonaio/templates/tree/main/nodejs';
  const template = options.template || 'nodejs';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAYTONA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: workspaceName,
        project: {
          name: projectName,
          repository: {
            url: repositoryUrl
          },
          source: {
            repository: {
              url: repositoryUrl
            }
          }
        },
        template: template
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Daytona API error (${response.status}): ${errorText}`);
    }

    const workspace = await response.json();
    
    // Wait for workspace to be ready (polling)
    if (workspace.id) {
      await waitForWorkspaceReady(workspace.id);
    }

    return workspace;
  } catch (error) {
    throw new Error(`Failed to create Daytona workspace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Wait for a workspace to be ready (status = 'Running').
 */
async function waitForWorkspaceReady(workspaceId: string, maxWaitMs = 60000): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const workspace = await getDaytonaWorkspace(workspaceId);
      if (workspace.status === 'Running' || workspace.status === 'running') {
        return;
      }
      // eslint-disable-next-line no-console
      console.log(`Waiting for workspace ${workspaceId} to be ready... (status: ${workspace.status})`);
    } catch (error) {
      // Continue polling even if there's an error
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Workspace ${workspaceId} did not become ready within ${maxWaitMs}ms`);
}

/**
 * Get a specific Daytona workspace by ID.
 */
export async function getDaytonaWorkspace(workspaceId: string): Promise<DaytonaWorkspace> {
  const url = `${DAYTONA_SERVER_URL}/workspaces/${workspaceId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DAYTONA_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Daytona API error (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get Daytona workspace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List available Daytona workspaces.
 */
export async function listDaytonaWorkspaces(): Promise<DaytonaWorkspace[]> {
  const url = `${DAYTONA_SERVER_URL}/workspaces`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DAYTONA_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Daytona API error (${response.status})`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.workspaces || [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to list Daytona workspaces:', error);
    return [];
  }
}

/**
 * Convert repro steps (text) into executable commands.
 * This is a simple heuristic - in production you'd want more sophisticated parsing.
 */
export function reproStepsToCommand(reproSteps: string): string {
  // Simple heuristic: extract the first command-like line or use a default
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
  
  // Default: try to run tests
  return 'npm test';
}

