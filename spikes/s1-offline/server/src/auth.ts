// Spike auth: ES256 JWTs from an in-memory key pair, published as a JWKS (PowerSync reads it).
// Claims: sub, tenant_id, branch_id, role, aud, exp. Never logged.
import { exportJWK, generateKeyPair, type JWK, jwtVerify, SignJWT } from 'jose';

export const AUDIENCE = 'shifa-s1';
const KID = 's1';

export type Role = 'reception' | 'patient';

export interface Principal {
  sub: string;
  tenantId: string;
  branchId: string;
  role: Role;
  /** Set when the client logged in with a device id: its commands must carry that id. */
  deviceId?: string;
}

export interface Auth {
  sign(principal: Principal): Promise<string>;
  /** Returns undefined for a missing, expired, foreign or malformed token. */
  verify(header: string | undefined): Promise<Principal | undefined>;
  jwks(): { keys: JWK[] };
}

export type SigningKeys = Awaited<ReturnType<typeof generateKeyPair>>;

/** A fresh ES256 key pair (share one between servers that PowerSync must both trust). */
export const newSigningKeys = (): Promise<SigningKeys> => generateKeyPair('ES256');

/** The clinic's date (Asia/Damascus): PowerSync streams sync "today" by this claim. */
const clinicDay = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date());

export async function createAuth(ttlSeconds: number, keys?: SigningKeys): Promise<Auth> {
  const { privateKey, publicKey } = keys ?? (await newSigningKeys());
  const publicJwk = { ...(await exportJWK(publicKey)), alg: 'ES256', kid: KID, use: 'sig' };
  return {
    sign: (p) =>
      new SignJWT({
        tenant_id: p.tenantId,
        branch_id: p.branchId,
        role: p.role,
        day: clinicDay(),
        ...(p.deviceId ? { device_id: p.deviceId } : {}),
      })
        .setProtectedHeader({ alg: 'ES256', kid: KID })
        .setSubject(p.sub)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
        .sign(privateKey),
    async verify(header) {
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      if (!token) return undefined;
      try {
        const { payload } = await jwtVerify(token, publicKey, {
          audience: AUDIENCE,
          algorithms: ['ES256'],
        });
        const {
          sub,
          tenant_id: tenantId,
          branch_id: branchId,
          role,
          device_id: deviceId,
        } = payload;
        if (typeof sub !== 'string' || typeof tenantId !== 'string' || typeof branchId !== 'string')
          return undefined;
        if (role !== 'reception' && role !== 'patient') return undefined;
        return typeof deviceId === 'string'
          ? { sub, tenantId, branchId, role, deviceId }
          : { sub, tenantId, branchId, role };
      } catch {
        return undefined;
      }
    },
    jwks: () => ({ keys: [publicJwk] }),
  };
}
