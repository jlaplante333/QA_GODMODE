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
  // Try different API endpoint paths
  const possiblePaths = [
    `/v1/workspaces/${workspaceId}/exec`,
    `/workspaces/${workspaceId}/exec`,
    `/api/v1/workspaces/${workspaceId}/exec`
  ];

  for (const path of possiblePaths) {
    const url = `${DAYTONA_SERVER_URL}${path}`;

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

      if (response.ok) {
        const data = await response.json();
        
        return {
          success: data.exitCode === 0,
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          exitCode: data.exitCode
        };
      }

      // If 404, try next path
      if (response.status === 404) {
        continue;
      }

      const errorText = await response.text();
      throw new Error(`Daytona API error (${response.status}): ${errorText}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        continue;
      }
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error)
      };
    }
  }

  return {
    success: false,
    stdout: '',
    stderr: 'Failed to execute command: all API endpoint paths returned 404'
  };
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
  // Since DAYTONA_SERVER_URL is already https://app.daytona.io/api, we just append the endpoint
  // Try different endpoint variations
  const possiblePaths = [
    '/workspace',  // Singular
    '/workspaces', // Plural
    '/v1/workspace',
    '/v1/workspaces'
  ];

  const workspaceName = options.name || `qa-repro-${Date.now()}`;
  const projectName = options.projectName || 'qa-repro';
  
  // Default to a minimal Node.js template if no repo is provided
  const repositoryUrl = options.repositoryUrl || 'https://github.com/daytonaio/templates/tree/main/nodejs';

  let lastError: Error | null = null;

  // Try each possible endpoint path
  for (const path of possiblePaths) {
    const url = `${DAYTONA_SERVER_URL}${path}`;

    try {
      // Try different request body formats
      const requestBodies = [
        // Format 1: Simple structure
        {
          name: workspaceName,
          project: {
            name: projectName,
            repository: {
              url: repositoryUrl
            }
          }
        },
        // Format 2: With source
        {
          name: workspaceName,
          project: {
            name: projectName,
            source: {
              repository: {
                url: repositoryUrl
              }
            }
          }
        },
        // Format 3: Minimal
        {
          name: workspaceName,
          repository: repositoryUrl
        }
      ];

      let found404 = false;
      for (const requestBody of requestBodies) {
        // eslint-disable-next-line no-console
        console.log(`Attempting to create workspace at: ${url} with body:`, JSON.stringify(requestBody, null, 2));

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DAYTONA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const workspace = await response.json();
          
          // Wait for workspace to be ready (polling)
          if (workspace.id) {
            await waitForWorkspaceReady(workspace.id);
          }

          return workspace;
        }

        // Track if we got a 404
        if (response.status === 404) {
          found404 = true;
          const errorText = await response.text();
          // eslint-disable-next-line no-console
          console.log(`404 at ${url}: ${errorText}`);
        } else {
          // If not 404, log the error but continue trying other formats
          const errorText = await response.text();
          // eslint-disable-next-line no-console
          console.log(`Error (${response.status}) at ${url}: ${errorText}`);
        }
      }

      // If 404 for all formats, try next path
      if (found404) {
        lastError = new Error(`Endpoint not found (${path})`);
        continue;
      }
    } catch (error) {
      if (error instanceof Error) {
        lastError = error;
        // eslint-disable-next-line no-console
        console.log(`Exception trying ${path}:`, error.message);
      }
    }
  }

  // If all paths failed, throw the last error
  throw new Error(`Failed to create Daytona workspace. Tried all endpoints and formats. Last error: ${lastError?.message || 'Unknown error'}`);
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
  // Try different API endpoint paths
  const possiblePaths = [
    '/v1/workspaces',
    '/workspaces',
    '/api/v1/workspaces'
  ];

  for (const path of possiblePaths) {
    const url = `${DAYTONA_SERVER_URL}${path}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${DAYTONA_API_KEY}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : data.workspaces || [];
      }

      // If 404, try next path
      if (response.status === 404) {
        continue;
      }

      throw new Error(`Daytona API error (${response.status})`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        continue;
      }
      // eslint-disable-next-line no-console
      console.error(`Failed to list Daytona workspaces at ${path}:`, error);
    }
  }

  // If all paths failed, return empty array
  return [];
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

