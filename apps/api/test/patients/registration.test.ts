// A-03 criteria 1–3 and 20 (A-03-02): reception registers a chart with its identity and gets the
// clinic's next file number. Contract rows `POST /patients` (create, replay, failed retry with the
// same id, `previous_file_number_taken`) and `GET /patients/:id` (identity part).
// - Required: given name, contact phone, sex, a date of birth or an age; optional father, family,
//   mother names, second phone, previous number. Phones through the A-01 normaliser (+963, +90).
// - One counter per clinic for all branches, from 1, never reused; 20 concurrent saves take 20
//   distinct consecutive numbers; a refused save takes none.
// - The previous number is unique per clinic after trimming (409 `previous_file_number_taken`).
// - The id is the client's: the same id and body again returns the stored chart; another body
//   with that id answers 409 `patient_id_taken`; another clinic may hold the same id.
// - One `patient.created` audit row per chart, ids only.
import { createRandom, generatePhone } from '@shifa/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import {
  type ChartBody,
  chartInput,
  chartOf,
  codeOf,
  patientAudit,
  register,
  registered,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;
let reception: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_11_27);
  clinic = await world.clinic();
  other = await world.clinic();
  reception = (
    await activeMember(world, clinic, [{ role: 'receptionist', branchId: clinic.branchId }])
  ).cookie;
});

afterAll(async () => {
  await world.app.app.close();
});

describe('register (criterion 1)', () => {
  it('saves the required parts and answers the chart summary', async () => {
    const phone = world.phone();
    const input = chartInput(`0${phone.slice(4)}`, { fatherName: null, familyName: null });
    const res = await register(world, reception, input);
    expect(res.statusCode, res.body).toBe(201);
    const chart = res.json<ChartBody>();
    expect(chart).toMatchObject({
      id: input.id,
      givenName: input.givenName,
      fatherName: null,
      familyName: null,
      motherName: null,
      displayName: input.givenName,
      contactPhone: phone,
      secondPhone: null,
      sex: input.sex,
      birthDate: input.birthDate,
      birthDateEstimated: false,
      previousFileNumber: null,
      state: 'active',
      registeredBranch: { id: clinic.branchId },
      createdByName: 'موظف تجريبي',
      updatedByName: 'موظف تجريبي',
      archivedAt: null,
      archivedByName: null,
      mergedInto: null,
    });
    expect(chart.fileNumber).toBeGreaterThanOrEqual(1);
    expect(typeof chart.registeredBranch?.name).toBe('string');
    expect(Date.parse(chart.createdAt)).not.toBeNaN();
    expect(chart.updatedAt).toBe(chart.createdAt);
    const read = await chartOf(world, reception, chart.id);
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual(chart);
  });

  it('keeps every optional part, trimmed and single-spaced; the display name is given, father, family', async () => {
    const second = generatePhone(createRandom(2026_11_27), 'TR');
    const res = await register(
      world,
      reception,
      chartInput(world.phone(), {
        givenName: '  عبد   الرحمن ',
        fatherName: 'أحمد',
        familyName: 'الحلبي',
        motherName: 'فاطمة',
        secondPhone: second.replace('+90', '0'),
      }),
    );
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({
      givenName: 'عبد الرحمن',
      fatherName: 'أحمد',
      familyName: 'الحلبي',
      motherName: 'فاطمة',
      displayName: 'عبد الرحمن أحمد الحلبي',
      secondPhone: second,
    });
  });

  it('takes a Turkish contact phone (Azaz)', async () => {
    const phone = generatePhone(createRandom(2026_11_28), 'TR');
    const res = await register(world, reception, chartInput(phone.replace('+', '00')));
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json<ChartBody>().contactPhone).toBe(phone);
  });

  it('refuses an invalid contact or second phone on its own path', async () => {
    const bad = await register(world, reception, chartInput('0912'));
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: { details: [{ path: 'body.contactPhone' }] } });
    const second = await register(
      world,
      reception,
      chartInput(world.phone(), { secondPhone: '+44 20 7946 0000' }),
    );
    expect(second.statusCode).toBe(400);
    expect(second.json()).toMatchObject({ error: { details: [{ path: 'body.secondPhone' }] } });
  });

  it('an age becomes an estimated date of birth on today’s Damascus day', async () => {
    const input: Record<string, unknown> = { ...chartInput(world.phone()) };
    delete input['birthDate'];
    const res = await register(world, reception, { ...input, age: { value: 14, unit: 'months' } });
    expect(res.statusCode, res.body).toBe(201);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(
      clock.now(),
    );
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    const back = new Date(Date.UTC(y, m - 1 - 14, 1));
    const last = new Date(Date.UTC(back.getUTCFullYear(), back.getUTCMonth() + 1, 0)).getUTCDate();
    const expected = new Date(
      Date.UTC(back.getUTCFullYear(), back.getUTCMonth(), Math.min(d, last)),
    )
      .toISOString()
      .slice(0, 10);
    expect(res.json()).toMatchObject({ birthDate: expected, birthDateEstimated: true });
  });

  it('an accountant may not register (403)', async () => {
    const accountant = await activeMember(world, clinic, [{ role: 'accountant', branchId: null }]);
    const res = await register(world, accountant.cookie, chartInput(world.phone()));
    expect(res.statusCode).toBe(403);
  });

  it('writes one patient.created row with ids only', async () => {
    const chart = await registered(world, reception, { previousFileNumber: 'P-900' });
    const rows = (await patientAudit(clinic)).filter((r) => r.targetId === chart.id);
    expect(rows.map((r) => r.event)).toEqual(['patient.created']);
    expect(rows[0]?.data).toEqual({});
  });
});

describe('file numbers (criterion 2)', () => {
  it('20 concurrent saves take 20 distinct consecutive numbers', async () => {
    const fresh = await world.clinic();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        register(world, fresh.owner.cookie, chartInput(world.phone())),
      ),
    );
    expect(results.map((r) => r.statusCode)).toEqual(Array(20).fill(201));
    const numbers = results.map((r) => r.json<ChartBody>().fileNumber).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('a refused save takes no number; the counter is the clinic’s own', async () => {
    const fresh = await world.clinic();
    const first = await registered(world, fresh.owner.cookie, { previousFileNumber: 'A-1' });
    expect(first.fileNumber).toBe(1);
    const refused = await register(
      world,
      fresh.owner.cookie,
      chartInput(world.phone(), { previousFileNumber: 'A-1' }),
    );
    expect(refused.statusCode).toBe(409);
    const invalid = await register(world, fresh.owner.cookie, chartInput('12'));
    expect(invalid.statusCode).toBe(400);
    const second = await registered(world, fresh.owner.cookie);
    expect(second.fileNumber).toBe(2);
    // Another clinic counts from 1 on its own.
    const elsewhere = await world.clinic();
    expect((await registered(world, elsewhere.owner.cookie)).fileNumber).toBe(1);
  });
});

describe('previous file number (criterion 2)', () => {
  it('is kept trimmed and unique per clinic after trimming (409)', async () => {
    const chart = await registered(world, reception, { previousFileNumber: '  K-17 ' });
    expect(chart.previousFileNumber).toBe('K-17');
    const taken = await register(
      world,
      reception,
      chartInput(world.phone(), { previousFileNumber: 'K-17   ' }),
    );
    expect(taken.statusCode).toBe(409);
    expect(codeOf(taken)).toBe('previous_file_number_taken');
    // Another clinic may hold the same paper number.
    const there = await register(
      world,
      other.owner.cookie,
      chartInput(world.phone(), { previousFileNumber: 'K-17' }),
    );
    expect(there.statusCode).toBe(201);
  });
});

describe('the client’s id (criterion 3)', () => {
  it('the same id and body again returns the stored chart and takes no number', async () => {
    const input = chartInput(world.phone(), { previousFileNumber: 'R-5' });
    const first = await register(world, reception, input);
    expect(first.statusCode).toBe(201);
    const again = await register(world, reception, input);
    expect(again.statusCode, again.body).toBe(201);
    expect(again.json()).toEqual(first.json());
    const next = await registered(world, reception);
    expect(next.fileNumber).toBe(first.json<ChartBody>().fileNumber + 1);
    const rows = (await patientAudit(clinic)).filter((r) => r.targetId === input.id);
    expect(rows).toHaveLength(1);
  });

  it('two saves of the same id at once give one chart', async () => {
    const input = chartInput(world.phone());
    const [a, b] = await Promise.all([
      register(world, reception, input),
      register(world, reception, input),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    expect(a.json<ChartBody>().fileNumber).toBe(b.json<ChartBody>().fileNumber);
  });

  it('another body with that id answers 409 patient_id_taken', async () => {
    const input = chartInput(world.phone());
    expect((await register(world, reception, input)).statusCode).toBe(201);
    const changed = await register(world, reception, { ...input, givenName: 'سلمى' });
    expect(changed.statusCode).toBe(409);
    expect(codeOf(changed)).toBe('patient_id_taken');
  });

  it('another clinic may hold the same id; neither sees the other’s chart', async () => {
    const input = chartInput(world.phone());
    const mine = await register(world, reception, input);
    const theirs = await register(world, other.owner.cookie, { ...input, givenName: 'سلمى' });
    expect([mine.statusCode, theirs.statusCode]).toEqual([201, 201]);
    const read = await chartOf(world, other.owner.cookie, input.id);
    expect(read.json<ChartBody>().givenName).toBe('سلمى');
    expect((await chartOf(world, reception, input.id)).json<ChartBody>().givenName).toBe(
      input.givenName,
    );
  });
});
