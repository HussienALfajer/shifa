// The throwaway provider interface (criterion 1, VOX-09): every vendor sits behind it, and the
// generator never knows which one it talks to. Errors carry status and vendor code only, never a
// response body, a header or a key (ADR-0026).

export type ProviderName = 'azure' | 'google' | 'silma' | 'fake';

export interface SynthesisResult {
  audio: Uint8Array;
  mime: string;
  sampleRate: number;
  charactersBilled: number;
  elapsedMs: number;
}

export interface TtsProvider {
  readonly name: ProviderName;
  synthesize(text: string, voice: string): Promise<SynthesisResult>;
}

/**
 * Voices under test. Azure: the two ar-SY neural voices. Google: six Chirp 3 HD ar-XA voices for
 * the pre-round, 3 male (Charon, Fenrir, Orus) and 3 female (Aoede, Kore, Leda), from the
 * vendor's Chirp 3 HD voice list. SILMA: its own default reference voice (no cloning).
 */
export const VOICES: Record<ProviderName, readonly string[]> = {
  azure: ['ar-SY-LaithNeural', 'ar-SY-AmanyNeural'],
  google: [
    'ar-XA-Chirp3-HD-Charon',
    'ar-XA-Chirp3-HD-Fenrir',
    'ar-XA-Chirp3-HD-Orus',
    'ar-XA-Chirp3-HD-Aoede',
    'ar-XA-Chirp3-HD-Kore',
    'ar-XA-Chirp3-HD-Leda',
  ],
  silma: ['default'],
  fake: ['fake-1'],
};

export interface ProviderErrorInit {
  status: number;
  vendorCode?: string | undefined;
  retryAfterMs?: number | undefined;
}

export class ProviderError extends Error {
  readonly status: number;
  readonly vendorCode: string | undefined;
  readonly retryAfterMs: number | undefined;
  readonly retryable: boolean;

  constructor(message: string, init: ProviderErrorInit) {
    super(message);
    this.name = 'ProviderError';
    this.status = init.status;
    this.vendorCode = init.vendorCode;
    this.retryAfterMs = init.retryAfterMs;
    // 0 = network failure before any status.
    this.retryable = init.status === 0 || init.status === 429 || init.status >= 500;
  }

  toJSON(): ProviderErrorInit & { name: string; message: string } {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      vendorCode: this.vendorCode,
      retryAfterMs: this.retryAfterMs,
    };
  }
}

/** Characters a vendor bills for a text: one per code point (no CJK in the Arabic set). */
export function billedCharacters(text: string): number {
  return Array.from(text).length;
}

/** Retry-After in seconds or as an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/**
 * Turns a non-2xx response into a ProviderError. Reads a JSON body only for the vendor's short
 * code (Google `error.status`, Azure `error.code`); the message never includes the body.
 */
export async function errorFromResponse(
  provider: ProviderName,
  res: Response,
): Promise<ProviderError> {
  let vendorCode: string | undefined;
  try {
    const body = (await res.json()) as { error?: { status?: unknown; code?: unknown } };
    const code = body.error?.status ?? body.error?.code;
    if (typeof code === 'string' && /^[A-Za-z_]{1,64}$/u.test(code)) vendorCode = code;
  } catch {
    // Not JSON: the status alone is recorded.
  }
  return new ProviderError(`${provider}: HTTP ${String(res.status)}`, {
    status: res.status,
    vendorCode,
    retryAfterMs: parseRetryAfter(res.headers.get('retry-after')),
  });
}

/** fetch with network failures mapped to a retryable ProviderError (no URL or key in it). */
export async function post(
  provider: ProviderName,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, method: 'POST' });
  } catch {
    throw new ProviderError(`${provider}: network error`, { status: 0 });
  }
}
