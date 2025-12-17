'use client';

import { useState, useEffect } from 'react';
import type { AgentRunResult } from '../lib/types';

type TimelineState =
  | 'IDLE'
  | 'INGEST'
  | 'CURATE_CONTEXT'
  | 'DIAGNOSE'
  | 'GENERATE_REPRO'
  | 'EXECUTE'
  | 'VERIFY'
  | 'DONE'
  | 'ERROR';

const TIMELINE_STEPS: { key: Exclude<TimelineState, 'IDLE' | 'ERROR'>; label: string }[] = [
  { key: 'INGEST', label: 'Ingest' },
  { key: 'CURATE_CONTEXT', label: 'Curate Context' },
  { key: 'DIAGNOSE', label: 'Diagnose' },
  { key: 'GENERATE_REPRO', label: 'Generate Repro' },
  { key: 'EXECUTE', label: 'Execute' },
  { key: 'VERIFY', label: 'Verify' },
  { key: 'DONE', label: 'Done' }
];

type DaytonaStatus = {
  connected: boolean;
  hasKey: boolean;
  serverUrl: string | null;
};

export default function HomePage() {
  const [stackTrace, setStackTrace] = useState<string>('');
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [timelineState, setTimelineState] = useState<TimelineState>('IDLE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daytonaStatus, setDaytonaStatus] = useState<DaytonaStatus | null>(null);
  const [daytonaExecuting, setDaytonaExecuting] = useState(false);
  const [daytonaResult, setDaytonaResult] = useState<{
    success: boolean;
    stdout: string;
    stderr?: string;
    command?: string;
    sandboxId?: string;
    sandboxName?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/daytona-status')
      .then((res) => res.json())
      .then((data) => setDaytonaStatus(data))
      .catch(() => setDaytonaStatus({ connected: false, hasKey: false, serverUrl: null }));
  }, []);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);

    // Step the local timeline through the states so the UX
    // mirrors the orchestrator even though it's one API call.
    setTimelineState('INGEST');
    try {
      setTimelineState('CURATE_CONTEXT');
      setTimelineState('DIAGNOSE');
      setTimelineState('GENERATE_REPRO');
      setTimelineState('EXECUTE');
      setTimelineState('VERIFY');

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stackTrace })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? `Request failed (${res.status})`);
      }

      const json = (await res.json()) as AgentRunResult;
      setResult(json);
      setTimelineState('DONE');
    } catch (err: unknown) {
      setTimelineState('ERROR');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDaytonaExecute() {
    if (!hasRun || !result?.reproAndFix?.reproSteps) {
      return;
    }

    setDaytonaExecuting(true);
    setDaytonaResult(null);
    setError(null);

    try {
      const res = await fetch('/api/daytona-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reproSteps: result.reproAndFix.reproSteps,
          sandboxName: `qa-repro-${Date.now()}`
        })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const errorMsg = payload.details 
          ? `${payload.error}: ${payload.details}${payload.suggestion ? `\n\nSuggestion: ${payload.suggestion}` : ''}`
          : payload.error ?? `Daytona execution failed (${res.status})`;
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setDaytonaResult(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setDaytonaResult({
        success: false,
        stdout: '',
        stderr: errorMessage
      });
    } finally {
      setDaytonaExecuting(false);
    }
  }

  const hasRun = !!result;

  return (
    <main className="app-root">
      <div className="card">
        <div className="title-row">
          <div>
            <div className="title-main">QA Agent Godmode</div>
            <div className="title-sub">
              Curated context → LLM reasoning → sandboxed execution → verification.
            </div>
          </div>
          <div className="pill-row">
            <span className="chip">Next.js + TypeScript</span>
            <span className="chip">Deterministic Orchestration</span>
            {daytonaStatus && (
              <span
                className="chip"
                style={{
                  backgroundColor: daytonaStatus.connected ? '#10b981' : '#ef4444',
                  color: '#fff',
                  fontWeight: 500
                }}
              >
                Daytona: {daytonaStatus.connected ? 'Connected' : 'Not Connected'}
              </span>
            )}
          </div>
        </div>

        <div className="timeline">
          {TIMELINE_STEPS.map((step) => {
            const idx = TIMELINE_STEPS.findIndex((s) => s.key === step.key);
            const activeIdx = TIMELINE_STEPS.findIndex((s) => s.key === timelineState);

            let className = 'timeline-step';
            if (activeIdx > idx) className += ' timeline-step--done';
            else if (activeIdx === idx) className += ' timeline-step--active';

            return (
              <span key={step.key} className={className}>
                {step.label}
              </span>
            );
          })}
        </div>

        <div style={{ height: 18 }} />

        <div className="grid grid-cols-2">
          <section className="panel">
            <div className="panel-header">
              <span>Raw Stack Trace</span>
              <span className="badge">INGEST (LLM never sees this)</span>
            </div>
            <p className="subtle-label">
              Paste a real or simulated Sentry / Node / browser stack trace. The Evidence Builder
              will curate a minimal ContextPack.
            </p>
            <textarea
              className="textarea"
              placeholder={[
                'TypeError: Cannot read properties of undefined (reading \'user\')',
                '    at getUserFromSession (/app/src/server/auth.ts:42:15)',
                '    at getProfile (/app/src/server/profile.ts:18:10)',
                '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)'
              ].join('\n')}
              value={stackTrace}
              onChange={(e) => setStackTrace(e.target.value)}
            />
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <button
                className="button-primary"
                onClick={handleAnalyze}
                disabled={loading || !stackTrace.trim()}
              >
                {loading ? 'Analyzing…' : 'Analyze Bug'}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setStackTrace(
                    [
                      'TypeError: Cannot read properties of undefined (reading \'user\')',
                      '    at getUserFromSession (/app/src/server/auth.ts:42:15)',
                      '    at getProfile (/app/src/server/profile.ts:18:10)',
                      '    at ProfilePage (/app/src/pages/profile.tsx:27:20)',
                      '    at renderWithHooks (node:internal/react-dom/server:123:22)',
                      '    at node:internal/react-dom/server:567:16',
                      '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)'
                    ].join('\n')
                  );
                }}
              >
                Use Sample Trace
              </button>
            </div>
            {error && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#fecaca' }}>
                API error: {error}
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>Context Pack</span>
              <span className="badge">Evidence Builder (no AI)</span>
            </div>
            <p className="subtle-label">
              Deterministically curated error, top frames, and suspected file. This is the only
              data the LLM sees.
            </p>
            <div className="output-box">
              {hasRun ? JSON.stringify(result.contextPack, null, 2) : '// waiting for analysis...'}
            </div>
          </section>
        </div>

        <div style={{ height: 18 }} />

        <div className="grid grid-cols-2">
          <section className="panel">
            <div className="panel-header">
              <span>Diagnosis</span>
              <span className="badge">AI Agent</span>
            </div>
            <p className="subtle-label">
              LLM-only reasoning over the ContextPack to infer probable root cause and user impact.
            </p>
            <div className="output-box">
              {hasRun
                ? JSON.stringify(result.diagnosis, null, 2)
                : '// no diagnosis yet; run Analyze Bug.'}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>Repro Steps + Fix Proposal</span>
              <span className="badge">AI Agent</span>
            </div>
            <p className="subtle-label">
              Minimal repro script plus a proposed code change. This is what flows into the
              sandboxed execution layer.
            </p>
            <div className="output-box">
              {hasRun
                ? JSON.stringify(result.reproAndFix, null, 2)
                : '// waiting for repro and fix from AI Agent.'}
            </div>
            {hasRun && daytonaStatus?.connected && (
              <div style={{ marginTop: 12 }}>
                <button
                  className="button-primary"
                  onClick={handleDaytonaExecute}
                  disabled={daytonaExecuting}
                  style={{ width: '100%' }}
                >
                  {daytonaExecuting
                    ? 'Creating sandbox & executing...'
                    : '🚀 Create Daytona Sandbox & Reproduce'}
                </button>
                {daytonaResult && (
                  <div style={{ marginTop: 8, fontSize: 11 }}>
                    <div style={{ color: daytonaResult.success ? '#10b981' : '#ef4444', marginBottom: 4 }}>
                      {daytonaResult.success ? '✅ Execution succeeded' : '❌ Execution failed'}
                    </div>
                    {daytonaResult.sandboxId && (
                      <div style={{ color: '#9ca3af', marginBottom: 4 }}>
                        Sandbox: {daytonaResult.sandboxName || daytonaResult.sandboxId}
                      </div>
                    )}
                    {daytonaResult.command && (
                      <div style={{ color: '#9ca3af', marginBottom: 4 }}>
                        Command: {daytonaResult.command}
                      </div>
                    )}
                    {daytonaResult.stdout && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: 'pointer', color: '#9ca3af', fontSize: 10 }}>
                          View output
                        </summary>
                        <pre
                          style={{
                            marginTop: 4,
                            padding: 8,
                            backgroundColor: '#1f2937',
                            borderRadius: 4,
                            fontSize: 10,
                            overflow: 'auto',
                            maxHeight: 200
                          }}
                        >
                          {daytonaResult.stdout}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div style={{ height: 18 }} />

        <div className="grid grid-cols-2">
          <section className="panel">
            <div className="panel-header">
              <span>Sandboxed Execution Output</span>
              <span className="badge">Execution Layer (mock Daytona)</span>
            </div>
            <p className="subtle-label">
              Deterministic mock run of the repro steps. No real infra touched, but enough signal to
              let the verifier decide if the fix holds.
            </p>
            <div className="output-box">
              {hasRun
                ? `${result.execution.stdout}\n\n(success: ${result.execution.success})`
                : '// execution has not run yet.'}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>Verification</span>
              <span className="badge">LLM Verifier</span>
            </div>
            <p className="subtle-label">
              LLM reads only the ContextPack, diagnosis, repro+fix, and sandbox output to decide if
              the bug is truly resolved.
            </p>
            <div className="output-box">
              {hasRun
                ? JSON.stringify(result.verification, null, 2)
                : '// verification result will show up here.'}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}


