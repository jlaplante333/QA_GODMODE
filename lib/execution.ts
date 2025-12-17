import { ExecutionResult } from './types';

/**
 * Mock Daytona-like sandbox execution.
 *
 * This does NOT run arbitrary user code. Instead, it deterministically
 * simulates running the repro steps in an isolated environment and returns
 * structured output which is then verified by the LLM.
 */
export async function runInSandbox(reproSteps: string): Promise<ExecutionResult> {
  // Simple deterministic heuristic:
  // - If the repro steps mention "tests green" or "no error", we treat it as success.
  // - If they mention "still failing" or "throws", we treat it as failure.
  const normalized = reproSteps.toLowerCase();

  let success = false;
  if (normalized.includes('tests green') || normalized.includes('no error')) {
    success = true;
  } else if (normalized.includes('still failing') || normalized.includes('throws')) {
    success = false;
  } else {
    // Default: assume partial success but with warnings, so we surface
    // uncertainty to the verifier step.
    success = false;
  }

  const stdoutLines: string[] = [];
  stdoutLines.push('=== Sandboxed Execution (Mock) ===');
  stdoutLines.push('');
  stdoutLines.push('This is a deterministic, fake execution environment.');
  stdoutLines.push('No real user code or infrastructure is touched.');
  stdoutLines.push('');
  stdoutLines.push('--- Repro Script (high level) ---');
  stdoutLines.push(reproSteps.trim() || '(no repro steps provided)');
  stdoutLines.push('');
  stdoutLines.push('--- Outcome ---');
  if (success) {
    stdoutLines.push('✅ All relevant steps completed without any simulated errors.');
    stdoutLines.push('✅ No error matching the original ContextPack was reproduced.');
  } else {
    stdoutLines.push('⚠️ Repro appears to still expose issues or could not be validated.');
    stdoutLines.push(
      '⚠️ Either the repro is incomplete or the proposed fix does not fully address the bug.'
    );
  }

  return {
    success,
    stdout: stdoutLines.join('\n')
  };
}


