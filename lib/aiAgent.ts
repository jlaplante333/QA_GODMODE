import { ContextPack, DiagnosisResult, ReproAndFix, VerificationResult, ExecutionResult } from './types';
import type { LlmClient } from './llmClient';

function parseJsonFromLlm<T>(raw: string): T {
  // Be forgiving: try to find the first {...} block and parse that.
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  const candidate = firstBrace !== -1 && lastBrace !== -1 ? raw.slice(firstBrace, lastBrace + 1) : raw;
  return JSON.parse(candidate) as T;
}

interface DiagnosePayload {
  diagnosis: DiagnosisResult;
  reproAndFix: ReproAndFix;
}

/**
 * LLM-only reasoning step.
 * Input: curated ContextPack
 * Output: diagnosis + repro steps + proposed fix.
 */
export async function diagnoseAndPlan(
  context: ContextPack,
  llm: LlmClient
): Promise<DiagnosePayload> {
  const content = await llm.chat([
    {
      role: 'system',
      content:
        'You are a senior TypeScript full-stack engineer. You only see curated error context, ' +
        'never full production logs. Answer concisely and return strict JSON.'
    },
    {
      role: 'user',
      content: [
        'You are given a ContextPack derived from a production stack trace.',
        '',
        'ContextPack JSON:',
        JSON.stringify(context, null, 2),
        '',
        'Tasks:',
        '1. Diagnose the most likely root cause and its impact on users.',
        '2. Generate minimal, deterministic repro steps a teammate can follow.',
        '3. Propose a concrete fix as a small code snippet or diff.',
        '',
        'Respond as **strict JSON** with the following shape:',
        '{',
        '  "diagnosis": {',
        '    "rootCause": "string",',
        '    "impactSummary": "string"',
        '  },',
        '  "reproAndFix": {',
        '    "reproSteps": "bullet-point steps in plain text",',
        '    "fixSnippet": "code snippet or diff in a fenced block",',
        '    "notes": "any caveats or assumptions"',
        '  }',
        '}'
      ].join('\n')
    }
  ]);

  return parseJsonFromLlm<DiagnosePayload>(content);
}

/**
 * Verification step: feed the sandbox execution output back to the LLM
 * and ask whether the fix likely worked.
 */
export async function verifyFixWithLlm(
  context: ContextPack,
  diagnosis: DiagnosisResult,
  reproAndFix: ReproAndFix,
  execution: ExecutionResult,
  llm: LlmClient
): Promise<VerificationResult> {
  const content = await llm.chat([
    {
      role: 'system',
      content:
        'You verify whether a proposed bug fix actually worked based on sandboxed execution output. ' +
        'Be honest and concise. Answer strictly as JSON.'
    },
    {
      role: 'user',
      content: [
        'You are given:',
        '',
        'ContextPack:',
        JSON.stringify(context, null, 2),
        '',
        'Diagnosis:',
        JSON.stringify(diagnosis, null, 2),
        '',
        'Repro + Fix:',
        JSON.stringify(reproAndFix, null, 2),
        '',
        'Sandbox Execution Result:',
        JSON.stringify(execution, null, 2),
        '',
        'Decide whether the fix likely worked.',
        '',
        'Respond as **strict JSON** with:',
        '{',
        '  "fixWorked": boolean,',
        '  "explanation": "short explanation; if false, explain what is still broken or uncertain"',
        '}'
      ].join('\n')
    }
  ]);

  return parseJsonFromLlm<VerificationResult>(content);
}


