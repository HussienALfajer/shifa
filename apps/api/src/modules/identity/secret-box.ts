// Encryption of TOTP secrets at rest (AES-256-GCM, key derived from BETTER_AUTH_SECRET with
// HKDF): a database dump alone does not give anyone's second factor. Stored as
// `v1.<iv>.<tag>.<ciphertext>` in base64url.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const INFO = 'shifa totp secret v1';

function keyOf(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'shifa', INFO, 32));
}

export function sealSecret(plain: Buffer, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv, tag, body]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

export function openSecret(sealed: string, secret: string): Buffer {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', keyOf(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]);
}
