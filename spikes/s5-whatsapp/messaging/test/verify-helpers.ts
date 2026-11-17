// Reverse-verification helpers for the suites: the device's two HTTP calls and the patient's
// phone sending the prefilled text to the platform number through the platform fake.
import type { Delivery } from '@shifa-spike/s5-fake-waha';
import type { Env } from './harness.ts';

export interface Issued {
  nonceId: string;
  deviceSecret: string;
  waLink: string;
  expiresAt: string;
  /** The prefilled text of the link (fixed phrase + code). */
  text: string;
  /** The code alone, as the link carries it. */
  code: string;
}

export async function requestNonce(
  env: Env,
  deviceId: string,
  phone: string,
): Promise<{ status: number; issued?: Issued; body: Record<string, unknown> }> {
  const res = await fetch(`${env.url}/verify/nonce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId, phone }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (res.status !== 201) return { status: res.status, body };
  const waLink = String(body['waLink']);
  const text = new URL(waLink).searchParams.get('text') ?? '';
  const code = /([A-Z0-9]{6})\s*$/.exec(text)?.[1] ?? '';
  return {
    status: res.status,
    body,
    issued: {
      nonceId: String(body['nonceId']),
      deviceSecret: String(body['deviceSecret']),
      waLink,
      expiresAt: String(body['expiresAt']),
      text,
      code,
    },
  };
}

/** Requests a nonce and fails the test when none is issued. */
export async function issue(env: Env, deviceId: string, phone: string): Promise<Issued> {
  const res = await requestNonce(env, deviceId, phone);
  if (!res.issued) throw new Error(`nonce not issued: ${String(res.status)}`);
  return res.issued;
}

export async function poll(
  env: Env,
  nonceId: string,
  headers: { deviceId?: string; deviceSecret?: string },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const h: Record<string, string> = {};
  if (headers.deviceId !== undefined) h['x-device-id'] = headers.deviceId;
  if (headers.deviceSecret !== undefined) h['x-device-secret'] = headers.deviceSecret;
  const res = await fetch(`${env.url}/verify/${encodeURIComponent(nonceId)}`, { headers: h });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** A phone (chat id) sends `body` to the platform number. */
export async function sendToPlatform(
  env: Env,
  from: string,
  body: string,
  kind?: 'edited' | 'revoked' | 'reaction',
): Promise<Delivery> {
  const fake = env.fakes.platform;
  if (!fake) throw new Error('platform fake');
  const res = await fake.inbound('platform', kind ? { from, body, kind } : { from, body });
  return res;
}

export const chatOf = (phone: string) => `${phone.slice(1)}@c.us`;

/** Platform sendText calls recorded by the fake. */
export const platformSends = (env: Env) =>
  (env.fakes.platform?.calls ?? []).filter((c) => c.path === '/api/sendText');

export const outcomes = async (env: Env) =>
  (await env.query<{ outcome: string }>('select outcome from s5.verify_attempt order by id')).map(
    (r) => r.outcome,
  );
