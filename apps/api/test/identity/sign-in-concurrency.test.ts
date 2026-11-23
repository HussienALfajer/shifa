// A-01a criterion 7 (review B1 of A-01-02): parallel attempts cannot outrun the limits. Each
// attempt is counted before any password is checked, so a burst for one phone gets at most five
// password checks, and a burst from one IP at most thirty.
import { syntheticPhones } from '@shifa/db/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../support.ts';
import { identityApp, PASSWORD, resetWithTenants, seedPerson, signIn } from './support.ts';

const phones = syntheticPhones(2026_11_21, 45);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp;

beforeEach(async () => {
  await resetWithTenants();
  app = await identityApp();
});

afterEach(async () => {
  await app.app.close();
});

const countBy = (statuses: number[]) =>
  statuses.reduce<Record<number, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});

describe('sign-in throttle under parallel attempts', () => {
  it('twenty parallel wrong passwords for one phone: five checked, the rest 429', async () => {
    await seedPerson(phone(0));
    const statuses = await Promise.all(
      Array.from({ length: 20 }, () =>
        signIn(app, phone(0), 'wrong password', { ip: '198.51.100.20' }).then((r) => r.statusCode),
      ),
    );
    const counts = countBy(statuses);
    // Four plain failures, the fifth starts the lock (429), fifteen refused (429).
    expect(counts[401]).toBe(4);
    expect(counts[429]).toBe(16);
    expect((await signIn(app, phone(0), PASSWORD, { ip: '198.51.100.21' })).statusCode).toBe(429);
  });

  it('forty parallel attempts from one IP on different phones: thirty checked', async () => {
    const statuses = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        signIn(app, phone(i + 1), 'wrong password', { ip: '198.51.100.30' }).then(
          (r) => r.statusCode,
        ),
      ),
    );
    const counts = countBy(statuses);
    expect(counts[401]).toBe(29);
    expect(counts[429]).toBe(11);
  });
});
