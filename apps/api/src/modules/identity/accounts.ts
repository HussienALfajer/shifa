// Account writes on the auth path (A-01-03), in Better Auth's schema: a person with a phone and a
// credential account (scrypt hash from better-auth/crypto), and setting or clearing that
// password. Plain functions on a `tx`, so the setup link, the owner reset and the seed share
// them inside their own transactions.
import { randomUUID } from 'node:crypto';
import { account, type Tx, user } from '@shifa/db';
import { and, eq } from 'drizzle-orm';

const CREDENTIAL = 'credential';

export async function userIdByPhone(tx: Tx, phoneE164: string): Promise<string | null> {
  const [row] = await tx.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phoneE164));
  return row?.id ?? null;
}

/** A new person with this phone and name; no password until `setPassword()`. */
export async function createPerson(
  tx: Tx,
  person: { name: string; phoneE164: string; now: Date },
): Promise<string> {
  const id = randomUUID();
  await tx.insert(user).values({
    id,
    name: person.name,
    // Better Auth requires a unique email; phone accounts get a placeholder (A-01-02).
    email: `${id}@users.shifa.invalid`,
    phoneNumber: person.phoneE164,
    phoneNumberVerified: false,
    createdAt: person.now,
    updatedAt: person.now,
  });
  return id;
}

/** Sets the credential password (`hash` from better-auth/crypto's hashPassword). */
export async function setPassword(tx: Tx, userId: string, hash: string, now: Date): Promise<void> {
  const updated = await tx
    .update(account)
    .set({ password: hash, updatedAt: now })
    .where(and(eq(account.userId, userId), eq(account.providerId, CREDENTIAL)))
    .returning({ id: account.id });
  if (updated.length > 0) return;
  await tx.insert(account).values({
    accountId: userId,
    providerId: CREDENTIAL,
    userId,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });
}

/** Removes the password: sign-in fails until a new setup link is used (owner reset). */
export async function clearPassword(tx: Tx, userId: string, now: Date): Promise<void> {
  await tx
    .update(account)
    .set({ password: null, updatedAt: now })
    .where(and(eq(account.userId, userId), eq(account.providerId, CREDENTIAL)));
}
