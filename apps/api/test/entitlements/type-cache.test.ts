// A-02 criterion 2 for the type change (review N5): the instance that changed a clinic's type
// resolves the new plan at once, even with the old plan cached.
import { syntheticPhones } from '@shifa/db/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { linkScope } from '../../src/access/index.ts';
import { ENTITLEMENTS, type EntitlementsPort } from '../../src/modules/entitlements/index.ts';
import { testClock } from '../identity/support.ts';
import {
  createClinicViaApi,
  patch,
  platformApp,
  resetDatabase,
  signedInAdmin,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';

const phones = syntheticPhones(2026_12_05, 2);
const clock = testClock();
let app: TestApp;

beforeAll(async () => {
  await resetDatabase();
  app = await platformApp(clock);
});

afterAll(async () => {
  await app.app.close();
});

it('a type change clears the writing instance’s cache entry', async () => {
  const admin = await signedInAdmin(app, clock, phones[0] ?? '');
  const { clinicId } = await createClinicViaApi(app, admin.cookie, phones[1] ?? '');
  const port = app.app.get<EntitlementsPort>(ENTITLEMENTS);
  const scope = linkScope({ tenantId: clinicId, userId: admin.userId });
  expect(await port.value(scope, 'limits.practitioners')).toBe(10);
  const res = await patch(app, `/platform/clinics/${clinicId}`, { type: 'solo' }, admin.cookie);
  expect(res.statusCode).toBe(200);
  expect(await port.value(scope, 'limits.practitioners')).toBe(1);
});
