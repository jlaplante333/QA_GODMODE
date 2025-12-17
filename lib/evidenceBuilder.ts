import { ContextPack } from './types';

// Maximum number of stack frames to keep in the curated context.
const MAX_FRAMES = 5;

// Hard cap on the total characters allowed in the context pack to keep
// prompts small and predictable for the LLM.
const MAX_CONTEXT_CHARS = 1200;

const VENDOR_PATTERNS = [
  'node_modules',
  'internal/',
  'node:internal',
  'next/dist',
  'webpack',
  'core-js',
  'regenerator-runtime'
];

function isVendorFrame(line: string): boolean {
  return VENDOR_PATTERNS.some((p) => line.includes(p));
}

function extractErrorMessage(lines: string[]): string {
  // Heuristic: first non-empty line that looks like an Error.
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/error/i.test(trimmed)) {
      return trimmed.slice(0, 280); // error budget
    }
  }
  // Fallback to first non-empty line.
  const first = lines.find((l) => l.trim());
  return (first ?? 'UnknownError: No error message found').trim().slice(0, 280);
}

function extractStackFrames(lines: string[]): string[] {
  const rawFrames = lines.filter((line) => line.trim().startsWith('at '));
  const nonVendor = rawFrames.filter((line) => !isVendorFrame(line));

  const frames = (nonVendor.length > 0 ? nonVendor : rawFrames).slice(0, MAX_FRAMES);

  return frames.map((f) => f.trim());
}

function guessSuspectedFile(frames: string[]): string | undefined {
  // Try to grab the first JS/TS file path from the top curated frames.
  for (const frame of frames) {
    const match = frame.match(/(\/[^:()]+?\.(?:tsx?|jsx?))/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Deterministic evidence builder.
 *
 * This is the only place that sees the raw stack trace string.
 * It extracts a small, opinionated "ContextPack" that is safe to expose to the LLM.
 */
export function buildContextPack(rawStackTrace: string): ContextPack {
  const lines = rawStackTrace.split(/\r?\n/);

  const error = extractErrorMessage(lines);
  const topFrames = extractStackFrames(lines);
  const suspectedFile = guessSuspectedFile(topFrames);

  let context: ContextPack = {
    error,
    topFrames,
    suspectedFile
  };

  // Enforce strict size budget.
  const serialized = JSON.stringify(context);
  if (serialized.length > MAX_CONTEXT_CHARS) {
    // Trim frames until we fit inside the budget.
    const trimmedFrames: string[] = [];
    for (const frame of topFrames) {
      trimmedFrames.push(frame);
      context = {
        ...context,
        topFrames: trimmedFrames
      };
      if (JSON.stringify(context).length > MAX_CONTEXT_CHARS) {
        trimmedFrames.pop();
        context = {
          ...context,
          topFrames: trimmedFrames
        };
        break;
      }
    }
  }

  return context;
}


