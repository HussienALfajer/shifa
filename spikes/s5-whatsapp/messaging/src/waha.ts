// Calls to a WAHA container, with the per-call timeout, and the classification the at-most-once
// rule needs: an answer, a refused connection (nothing was sent), a timeout or a cut connection
// (the outcome is unknown).
import type { ContainerConfig } from './config.ts';

export type WahaResult =
  | { kind: 'ok'; status: number; json: Record<string, unknown> }
  | { kind: 'http'; status: number; text: string }
  | { kind: 'refused' }
  | { kind: 'timeout' }
  | { kind: 'network' };

export async function wahaCall(
  container: ContainerConfig,
  method: 'GET' | 'POST',
  path: string,
  body: Record<string, unknown> | undefined,
  timeoutMs: number,
): Promise<WahaResult> {
  try {
    const res = await fetch(`${container.wahaUrl}${path}`, {
      method,
      headers: { 'x-api-key': container.apiKey, 'content-type': 'application/json' },
      body: body === undefined ? null : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) return { kind: 'http', status: res.status, text };
    return {
      kind: 'ok',
      status: res.status,
      json: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    };
  } catch (error) {
    const err = error as Error & { cause?: { code?: string } };
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return { kind: 'timeout' };
    if (err.cause?.code === 'ECONNREFUSED') return { kind: 'refused' };
    return { kind: 'network' };
  }
}

/**
 * RN-10 ban signals: WAHA reports them as "server returned error 463" (reachout timelock) and
 * "... 475" (capped). Only that phrase counts, so digits elsewhere (a number) never match.
 */
export function banCode(text: string): 463 | 475 | null {
  const match = /server returned error (463|475)\b/.exec(text);
  if (!match) return null;
  return match[1] === '463' ? 463 : 475;
}

/** `<digits>@c.us` (or `@s.whatsapp.net`) → `+<digits>`; anything else → null. */
export function phoneOfChat(chatId: string): string | null {
  const match = /^(\d{6,15})@(c\.us|s\.whatsapp\.net)$/.exec(chatId);
  return match?.[1] ? `+${match[1]}` : null;
}

export const chatOfPhone = (phone: string) => `${phone.replace(/^\+/, '')}@c.us`;

/** Chats that never count as a patient writing to the clinic. */
export const isGroupOrBroadcast = (chatId: string) => /@(g\.us|broadcast|newsletter)$/.test(chatId);
