// Service-account auth without a Google SDK (criterion 2): an RS256 JWT signed with node:crypto,
// exchanged at the token URL for an access token, cached until 60 s before expiry. The key, the
// assertion and the access token are never logged or put into an error.
import { createSign } from 'node:crypto';

export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const LIFETIME_SECONDS = 3600;
const REFRESH_MARGIN_MS = 60_000;

export interface ServiceAccount {
  type?: string;
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function signAssertion(sa: ServiceAccount, tokenUrl: string, nowMs: number): string {
  const iat = Math.floor(nowMs / 1000);
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: tokenUrl,
    iat,
    exp: iat + LIFETIME_SECONDS,
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  return `${unsigned}.${signer.sign(sa.private_key, 'base64url')}`;
}

export interface TokenProvider {
  getToken: () => Promise<string>;
}

export interface TokenProviderOptions {
  serviceAccount: ServiceAccount;
  tokenUrl: string;
  now?: () => number;
  log?: (line: string) => void;
}

/** Only a short OAuth error code (`invalid_grant`) is kept from an error body. */
function errorCode(body: unknown): string {
  const code = (body as { error?: unknown } | null)?.error;
  return typeof code === 'string' && /^[a-z_]{1,40}$/.test(code) ? code : 'unknown_error';
}

export function createTokenProvider(opts: TokenProviderOptions): TokenProvider {
  const now = opts.now ?? Date.now;
  const log =
    opts.log ??
    (() => {
      /* silent by default */
    });
  let cached: { token: string; expiresAt: number } | undefined;
  let inflight: Promise<string> | undefined;

  const fetchToken = async (): Promise<string> => {
    const issuedAt = now();
    log('token: requesting an access token');
    let assertion: string;
    try {
      assertion = signAssertion(opts.serviceAccount, opts.tokenUrl, issuedAt);
    } catch {
      throw new Error('service-account private key cannot sign (malformed key)');
    }
    let res: Response;
    try {
      res = await fetch(opts.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      });
    } catch {
      // The cause may carry request details; drop it.
      throw new Error('token endpoint unreachable');
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      log(`token: refused with ${String(res.status)}`);
      throw new Error(`token endpoint returned ${String(res.status)} (${errorCode(body)})`);
    }
    const { access_token, expires_in } = (body ?? {}) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof access_token !== 'string' || typeof expires_in !== 'number')
      throw new Error('token endpoint returned an unexpected body');
    cached = { token: access_token, expiresAt: issuedAt + expires_in * 1000 };
    log(`token: ok, expires in ${String(expires_in)} s`);
    return access_token;
  };

  return {
    getToken: () => {
      if (cached && now() < cached.expiresAt - REFRESH_MARGIN_MS)
        return Promise.resolve(cached.token);
      inflight ??= fetchToken().finally(() => {
        inflight = undefined;
      });
      return inflight;
    },
  };
}
