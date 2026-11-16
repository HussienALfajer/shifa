// Gateway credentials. HS256 only (algorithm pinned), exp required, 30 s clock skew; sub,
// tenant and role claims required. The tenant comes from the token only, never from the URL.
// Three kinds, kept apart by the `typ` claim so none can stand in for another:
// - bearer tokens (no typ): users at most 5 minutes; the edge credential at most 12 hours (a P1
//   push outlasts a user token, and Orthanc's peer header is fixed at start);
// - one-time viewer codes (typ viewer-code, jti, at most 2 minutes), exchanged once for
// - the viewer session (typ viewer-session, at most 8 hours), sent only as an HttpOnly cookie
//   and accepted on GET DICOMweb and viewer routes only.
import { errors, type JWTPayload, jwtVerify, SignJWT } from 'jose';
import type { Role } from './routes.ts';

export interface Principal {
  actor: string;
  tenant: string;
  role: Role;
}

const ROLES: readonly Role[] = ['viewer', 'uploader', 'edge'];
export const MAX_TTL_SECONDS = 300;
export const EDGE_MAX_TTL_SECONDS = 12 * 3600;
export const CODE_MAX_TTL_SECONDS = 120;
export const SESSION_TTL_SECONDS = 8 * 3600;
/**
 * Production: `__Host-s4_viewer` over TLS. Chromium refuses the `__Host-` prefix from the spike's
 * plain-HTTP origin even when that origin is marked trustworthy, so the spike keeps a plain name.
 */
export const SESSION_COOKIE = 's4_viewer';
const SKEW_SECONDS = 30;

export type AuthResult = { ok: true; principal: Principal } | { ok: false; status: 401 | 403 };
type Kind = 'bearer' | 'viewer-code' | 'viewer-session';

async function verify(
  token: string | undefined,
  key: Uint8Array,
  tenants: ReadonlySet<string>,
  kind: Kind,
): Promise<AuthResult & { payload?: JWTPayload }> {
  if (!token || !/^[A-Za-z0-9._-]+$/.test(token)) return { ok: false, status: 401 };
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      clockTolerance: SKEW_SECONDS,
      requiredClaims: ['exp', 'sub', 'tenant', 'role'],
    });
    const { sub, tenant, role, typ, jti } = payload as Record<string, unknown>;
    if (typeof sub !== 'string' || typeof tenant !== 'string' || typeof role !== 'string') {
      return { ok: false, status: 401 };
    }
    if ((kind === 'bearer' ? undefined : kind) !== typ) return { ok: false, status: 401 };
    if (kind === 'viewer-code' && (typeof jti !== 'string' || jti.length < 16)) {
      return { ok: false, status: 401 };
    }
    const maxTtl =
      kind === 'viewer-code'
        ? CODE_MAX_TTL_SECONDS
        : kind === 'viewer-session'
          ? SESSION_TTL_SECONDS
          : role === 'edge'
            ? EDGE_MAX_TTL_SECONDS
            : MAX_TTL_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    if ((payload.exp ?? 0) > now + maxTtl + SKEW_SECONDS) return { ok: false, status: 401 };
    if (!ROLES.includes(role as Role) || !tenants.has(tenant)) return { ok: false, status: 403 };
    if (kind !== 'bearer' && role !== 'viewer') return { ok: false, status: 403 };
    return { ok: true, principal: { actor: sub, tenant, role: role as Role }, payload };
  } catch (error) {
    if (error instanceof errors.JOSEError) return { ok: false, status: 401 };
    throw error;
  }
}

/** A `Bearer …` Authorization header. */
export async function authenticate(
  header: string | undefined,
  key: Uint8Array,
  tenants: ReadonlySet<string>,
): Promise<AuthResult> {
  const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(header ?? '')?.[1];
  const result = await verify(token, key, tenants, 'bearer');
  return result.ok ? { ok: true, principal: result.principal } : result;
}

/** The viewer session cookie from a Cookie header. */
export async function authenticateCookie(
  header: string | undefined,
  key: Uint8Array,
  tenants: ReadonlySet<string>,
): Promise<AuthResult> {
  const result = await verify(sessionCookie(header), key, tenants, 'viewer-session');
  return result.ok ? { ok: true, principal: result.principal } : result;
}

export const sessionCookie = (header: string | undefined): string | undefined =>
  (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

/** Verifies a one-time code; the caller records its jti before issuing a session. */
export async function verifyCode(
  code: string | undefined,
  key: Uint8Array,
  tenants: ReadonlySet<string>,
): Promise<(AuthResult & { ok: true; jti: string }) | (AuthResult & { ok: false })> {
  const result = await verify(code, key, tenants, 'viewer-code');
  if (!result.ok) return result;
  return { ok: true, principal: result.principal, jti: String(result.payload?.jti) };
}

/** Signs the session cookie value for a verified code's principal. */
export function signSession(principal: Principal, key: Uint8Array): Promise<string> {
  return new SignJWT({
    sub: principal.actor,
    tenant: principal.tenant,
    role: 'viewer',
    typ: 'viewer-session',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(key);
}
