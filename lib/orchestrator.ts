import {
  AgentRunResult,
  AgentState,
  ContextPack,
  DiagnosisResult,
  ExecutionResult,
  ReproAndFix,
  VerificationResult
} from './types';
import { buildContextPack } from './evidenceBuilder';
import { diagnoseAndPlan, verifyFixWithLlm } from './aiAgent';
import { runInSandbox } from './execution';
import { OpenAiLikeClient } from './llmClient';

/**
 * Simple, deterministic state-machine style agent orchestrator.
 *
 * INGEST -> CURATE_CONTEXT -> DIAGNOSE -> GENERATE_REPRO -> EXECUTE -> VERIFY
 */
export async function runQaAgent(
  rawStackTrace: string
): Promise<AgentRunResult> {
  let state: AgentState = 'INGEST';

  let contextPack!: ContextPack;
  let diagnosis!: DiagnosisResult;
  let reproAndFix!: ReproAndFix;
  let execution!: ExecutionResult;
  let verification!: VerificationResult;

  const llm = new OpenAiLikeClient();

  // INGEST: accept raw stack trace, do not expose it to the LLM.
  if (state === 'INGEST') {
    // No-op besides moving to next state; we keep the raw stack trace local.
    state = 'CURATE_CONTEXT';
  }

  // CURATE_CONTEXT: Evidence Builder (deterministic, no AI).
  if (state === 'CURATE_CONTEXT') {
    contextPack = buildContextPack(rawStackTrace);
    state = 'DIAGNOSE';
  }

  // DIAGNOSE + GENERATE_REPRO: handled in a single LLM call, but logically
  // split into two state transitions.
  if (state === 'DIAGNOSE') {
    const { diagnosis: d, reproAndFix: rf } = await diagnoseAndPlan(contextPack, llm);
    diagnosis = d;
    reproAndFix = rf;
    state = 'GENERATE_REPRO';
  }

  if (state === 'GENERATE_REPRO') {
    // The repro steps + fix were already computed in DIAGNOSE; this state
    // exists so the flow is explicit and debuggable.
    state = 'EXECUTE';
  }

  // EXECUTION layer (mock Daytona-style).
  if (state === 'EXECUTE') {
    execution = await runInSandbox(reproAndFix.reproSteps);
    state = 'VERIFY';
  }

  // Verification step: LLM checks sandboxed output.
  if (state === 'VERIFY') {
    verification = await verifyFixWithLlm(contextPack, diagnosis, reproAndFix, execution, llm);
    state = 'DONE';
  }

  if (state !== 'DONE') {
    throw new Error(`Agent did not reach DONE state; stopped at ${state}`);
  }

  return {
    contextPack,
    diagnosis,
    reproAndFix,
    execution,
    verification
  };
}


