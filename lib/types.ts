// Shared types for the QA Agent system

export type AgentState =
  | 'INGEST'
  | 'CURATE_CONTEXT'
  | 'DIAGNOSE'
  | 'GENERATE_REPRO'
  | 'EXECUTE'
  | 'VERIFY'
  | 'DONE';

// Deterministic, code-built context pack derived from a raw stack trace.
export type ContextPack = {
  error: string;
  topFrames: string[];
  suspectedFile?: string;
};

export interface DiagnosisResult {
  rootCause: string;
  impactSummary: string;
}

export interface ReproAndFix {
  reproSteps: string;
  fixSnippet: string;
  notes?: string;
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
}

export interface VerificationResult {
  fixWorked: boolean;
  explanation: string;
}

export interface AgentRunResult {
  contextPack: ContextPack;
  diagnosis: DiagnosisResult;
  reproAndFix: ReproAndFix;
  execution: ExecutionResult;
  verification: VerificationResult;
}


