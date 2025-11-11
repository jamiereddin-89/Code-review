export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type ChatResult = { content: string; provider: 'pollinations' | 'puter'; model?: string };

export interface AIProvider {
  name: 'pollinations' | 'puter';
  available: () => Promise<boolean>;
  chat: (messages: ChatMessage[], options?: { model?: string; timeoutMs?: number; signal?: AbortSignal }) => Promise<ChatResult>;
}

async function withTimeout<T>(p: Promise<T>, ms: number, msg = 'Request timed out'): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, reject) => (t = setTimeout(() => reject(new Error(msg)), ms)));
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

// Pollinations primary provider
export const pollinationsProvider: AIProvider = {
  name: 'pollinations',
  available: async () => true,
  chat: async (messages, options) => {
    const body = {
      messages,
      model: options?.model ?? 'openai/gpt-4o-mini',
      seed: Math.floor(Math.random() * 1e9),
    };

    const req = fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Pollinations error ${res.status}`);
      const data = await res.json().catch(() => null);
      const text = typeof data === 'string' ? data : data?.content ?? await res.text();
      if (!text) throw new Error('Empty response');
      return { content: String(text), provider: 'pollinations' as const, model: body.model };
    });

    return withTimeout(req, options?.timeoutMs ?? 30000);
  },
};

// Puter secondary provider
export const puterProvider: AIProvider = {
  name: 'puter',
  available: async () => Boolean(window.puter?.ai?.chat),
  chat: async (messages, options) => {
    const api = window.puter?.ai;
    if (!api?.chat) throw new Error('Puter AI not available');
    const r = await withTimeout(api.chat({ messages, model: options?.model }), options?.timeoutMs ?? 30000);
    if (!r?.content) throw new Error('Empty response');
    return { content: r.content, provider: 'puter', model: options?.model };
  },
};

export async function dualChat(messages: ChatMessage[], opts?: { preferred?: 'pollinations' | 'puter'; model?: string; timeoutMs?: number }) {
  const order: AIProvider[] = [];
  if (opts?.preferred === 'puter') order.push(puterProvider, pollinationsProvider);
  else order.push(pollinationsProvider, puterProvider);

  let lastError: unknown = null;
  for (const provider of order) {
    try {
      if (!(await provider.available())) continue;
      return await provider.chat(messages, { model: opts?.model, timeoutMs: opts?.timeoutMs });
    } catch (e) {
      lastError = e;
      // try next
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All providers failed');
}
