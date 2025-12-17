// Minimal LLM client wrapper. No heavy agent frameworks, just a thin fetch.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmClient {
  chat(messages: ChatMessage[]): Promise<string>;
}

/**
 * Very small OpenAI-compatible client.
 * You can point this at any compatible API that speaks the Chat Completions protocol.
 */
export class OpenAiLikeClient implements LlmClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string }) {
    const key = opts?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      // Extra diagnostic in dev: surface whether the env var is present at all.
      // This log stays server-side only.
      // eslint-disable-next-line no-console
      console.error('LLM client missing OPENAI_API_KEY. process.env keys:', Object.keys(process.env ?? {}));
      throw new Error('Missing OPENAI_API_KEY for LLM client');
    }
    this.apiKey = key;
    this.baseUrl = opts?.baseUrl ?? 'https://api.openai.com/v1';
    this.model = opts?.model ?? 'gpt-4.1-mini';
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.1
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM error (${res.status}): ${text}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('LLM response missing content');
    }
    return content;
  }
}


