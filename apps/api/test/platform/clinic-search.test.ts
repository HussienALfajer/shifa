// Contract fix of A-02-03 (A-02-screen-contract.md, "Existing API"): GET /platform/clinics?search=
// matches a folded name (alef forms, taa marbuta, alef maqsura, diacritics) at the start of a word,
// with the one Arabic fold Combobox uses, so the flags and announcements clinic pickers find what
// the person types.
import { ClinicList } from '@shifa/contracts';
import { syntheticPhones } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { get, testClock } from '../identity/support.ts';
import type { TestApp } from '../support.ts';
import {
  createClinicViaApi,
  platformApp,
  resetDatabase,
  type SignedInAdmin,
  signedInAdmin,
} from './support.ts';

const phones = syntheticPhones(2026_12_24, 6);
let app: TestApp;
let admin: SignedInAdmin;

const NAMES = ['عيادة أحمد الطبية', 'مركز الهدى', 'عِيَادَة الإِسراء', 'مستشفى الرحمة'];

beforeAll(async () => {
  await resetDatabase();
  const clock = testClock();
  app = await platformApp(clock);
  admin = await signedInAdmin(app, clock, phones[0] ?? '');
  for (const [i, name] of NAMES.entries()) {
    await createClinicViaApi(app, admin.cookie, phones[i + 1] ?? '', { name });
  }
});

afterAll(async () => {
  await app.app.close();
});

async function found(search: string): Promise<string[]> {
  const res = await get(
    app,
    `/platform/clinics?search=${encodeURIComponent(search)}`,
    admin.cookie,
  );
  expect(res.statusCode, res.body).toBe(200);
  return ClinicList.parse(res.json())
    .clinics.map((c) => c.name)
    .sort();
}

describe('clinic search (folded, at the start of a word)', () => {
  it.each([
    ['احمد', ['عيادة أحمد الطبية']],
    ['الطبيه', ['عيادة أحمد الطبية']],
    ['الهدي', ['مركز الهدى']],
    ['الاسراء', ['عِيَادَة الإِسراء']],
    ['عياده', ['عِيَادَة الإِسراء', 'عيادة أحمد الطبية']],
    ['  مستشفى   الرحمه ', ['مستشفى الرحمة']],
  ])('«%s» finds %j', async (search, names) => {
    expect(await found(search)).toEqual([...names].sort());
  });

  it('a match inside a word does not count', async () => {
    expect(await found('حمد')).toEqual([]);
    expect(await found('هدى')).toEqual([]);
  });

  it('LIKE wildcards are plain text', async () => {
    expect(await found('%')).toEqual([]);
    expect(await found('_')).toEqual([]);
  });

  it('no search lists every clinic', async () => {
    const res = await get(app, '/platform/clinics', admin.cookie);
    expect(ClinicList.parse(res.json()).clinics).toHaveLength(NAMES.length);
  });
});
