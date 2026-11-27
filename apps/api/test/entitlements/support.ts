// Helpers for the A-02-02 tests: Damascus calendar dates relative to a clock, the super admin's
// entitlement calls, and doctors and branches written straight into a clinic (superuser).
import { randomUUID } from 'node:crypto';
import { branch, membership, roleAssignment, tenantOverrideEvent } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { eq } from 'drizzle-orm';
import { sessionCookie, signIn } from '../identity/support.ts';
import { totpAt } from '../identity/totp.ts';
import { post, type SignedInAdmin } from '../platform/support.ts';
import type { TestApp } from '../support.ts';

const DAMASCUS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Damascus',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Damascus calendar day of `at`, `YYYY-MM-DD`, moved by `days`. */
export function damascusDay(at: Date, days = 0): string {
  const [y, m, d] = DAMASCUS.format(at).split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

export function put(app: TestApp, url: string, body: unknown, cookie: string) {
  return app.app.inject({
    method: 'PUT',
    url,
    headers: { cookie },
    payload: body as Record<string, unknown>,
  });
}

export function del(app: TestApp, url: string, cookie: string) {
  return app.app.inject({ method: 'DELETE', url, headers: { cookie } });
}

const su = () => superuserDb(workerDatabaseName());

/** A new session of the super admin (password and TOTP), after a clock jump past its limits. */
export async function signInAgain(
  app: TestApp,
  clock: FixedClock,
  admin: SignedInAdmin,
): Promise<SignedInAdmin> {
  const pending = sessionCookie(await signIn(app, admin.phone));
  const passed = await post(
    app,
    '/auth/mfa/challenge',
    { method: 'totp', code: totpAt(admin.manualKey, clock.now()) },
    pending,
  );
  if (passed.statusCode !== 200) throw new Error(`challenge: ${String(passed.statusCode)}`);
  return { ...admin, cookie: sessionCookie(passed) };
}

/** A member holding the doctor role clinic-wide, in `status`. */
export async function addDoctor(
  tenantId: string,
  phone: string,
  status: 'pending' | 'active' | 'deactivated' = 'pending',
): Promise<void> {
  const id = randomUUID();
  // An active membership must be bound to an account: these tests count pending and deactivated
  // ones only (the count treats pending and active alike).
  await su()
    .insert(membership)
    .values({ id, tenantId, phoneE164: phone, displayName: 'طبيب تجريبي', status });
  await su().insert(roleAssignment).values({ tenantId, membershipId: id, role: 'doctor' });
}

export async function addBranch(tenantId: string, archived = false): Promise<void> {
  await su()
    .insert(branch)
    .values({
      tenantId,
      name: `فرع ${randomUUID().slice(0, 4)}`,
      archivedAt: archived ? new Date() : null,
    });
}

export function overrideEventRows(tenantId: string) {
  return su()
    .select()
    .from(tenantOverrideEvent)
    .where(eq(tenantOverrideEvent.tenantId, tenantId))
    .orderBy(tenantOverrideEvent.at);
}
