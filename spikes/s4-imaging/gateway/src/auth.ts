// Short-lived gateway tokens: HS256 only (algorithm pinned), exp required and at most five
// minutes ahead, 30 s clock skew; sub, tenant and role claims required. The tenant comes from
// the token only, never from the URL.
import { errors, jwtVerify } from 'jose';
import type { Role } from './routes.ts';

export interface Principal {
  actor: string;
  tenant: string;
  role: Role;
}

const ROLES: readonly Role[] = ['viewer', 'uploader', 'edge'];
export const MAX_TTL_SECONDS = 300;
const SKEW_SECONDS = 30;

export type AuthResult = { ok: true; principal: Principal } | { ok: false; status: 401 | 403 };

export async function authenticate(
  header: string | undefined,
  key: Uint8Array,
  tenants: ReadonlySet<string>,
): Promise<AuthResult> {
  const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(header ?? '')?.[1];
  if (!token) return { ok: false, status: 401 };
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      clockTolerance: SKEW_SECONDS,
      requiredClaims: ['exp', 'sub', 'tenant', 'role'],
    });
    const now = Math.floor(Date.now() / 1000);
    if ((payload.exp ?? 0) > now + MAX_TTL_SECONDS + SKEW_SECONDS)
      return { ok: false, status: 401 };
    const { sub, tenant, role } = payload as { sub?: unknown; tenant?: unknown; role?: unknown };
    if (typeof sub !== 'string' || typeof tenant !== 'string' || typeof role !== 'string') {
      return { ok: false, status: 401 };
    }
    if (!ROLES.includes(role as Role) || !tenants.has(tenant)) return { ok: false, status: 403 };
    return { ok: true, principal: { actor: sub, tenant, role: role as Role } };
  } catch (error) {
    if (error instanceof errors.JOSEError) return { ok: false, status: 401 };
    throw error;
  }
}
