// A-03 criteria 9 and 29 (A-03-04): charts with the same contact phone form a family, each with an
// optional relation to the phone's holder. Contract rows `POST /patients/family` (holder, members,
// relation asked only with a holder), `relation` and `family` in the summary, `familySize` and
// `relation` in search results.
// - A phone new to the clinic makes the chart its holder (`relation: "holder"`); the relation is
//   asked only when the phone has a holder: a second holder, or a relation on a new phone, is
//   refused on `body.relation`.
// - Family lists hold active charts only; the preview leaves out `excludeId`; it writes no audit.
// - Changing the phone moves the chart to that family (its holder when the phone is new).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import {
  archive,
  type ChartBody,
  chartInput,
  chartOf,
  codeOf,
  edit,
  type FamilyCard,
  familyOf,
  found,
  patientAudit,
  register,
  registered,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;
let reception: string;
let accountant: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_05);
  clinic = await world.clinic();
  other = await world.clinic();
  reception = (await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]))
    .cookie;
  accountant = (await activeMember(world, clinic, [{ role: 'accountant', branchId: null }])).cookie;
});

afterAll(async () => {
  await world.app.app.close();
});

interface Family {
  holder: FamilyCard | null;
  members: FamilyCard[];
}

async function family(phone: string, excludeId: string | null = null): Promise<Family> {
  const res = await familyOf(world, reception, { phone, excludeId });
  if (res.statusCode !== 200) throw new Error(`family: ${String(res.statusCode)} ${res.body}`);
  return res.json<Family>();
}

const cardOf = (c: ChartBody, relation: string | null): FamilyCard => ({
  id: c.id,
  displayName: c.displayName,
  fileNumber: c.fileNumber,
  sex: c.sex,
  birthDate: c.birthDate,
  birthDateEstimated: c.birthDateEstimated,
  contactPhone: c.contactPhone,
  state: c.state,
  relation,
});

describe('a family by phone (criteria 9, 29)', () => {
  it('a new phone has no family, and its first chart becomes the holder', async () => {
    const phone = world.phone();
    expect(await family(phone)).toEqual({ holder: null, members: [] });
    const holder = await registered(world, reception, { contactPhone: phone });
    expect(holder.relation).toBe('holder');
    expect(holder.family).toEqual([]);
    expect(await family(`0${phone.slice(4)}`)).toEqual({
      holder: cardOf(holder, 'holder'),
      members: [],
    });
  });

  it('a member joins with a relation; the summaries list each other', async () => {
    const phone = world.phone();
    const holder = await registered(world, reception, { contactPhone: phone });
    const daughter = await registered(world, reception, {
      contactPhone: phone,
      relation: 'daughter',
    });
    expect(daughter.relation).toBe('daughter');
    const none = await registered(world, reception, { contactPhone: phone });
    expect(none.relation).toBeNull();
    const theirs = (await chartOf(world, reception, daughter.id)).json<ChartBody>();
    expect(theirs.family).toEqual([cardOf(holder, 'holder'), cardOf(none, null)]);
    const preview = await family(phone);
    expect(preview.holder).toEqual(cardOf(holder, 'holder'));
    expect(preview.members).toEqual([cardOf(daughter, 'daughter'), cardOf(none, null)]);
    const read = (await chartOf(world, reception, holder.id)).json<ChartBody>();
    expect(read.family).toEqual([cardOf(daughter, 'daughter'), cardOf(none, null)]);
    expect((await family(phone, daughter.id)).members).toEqual([cardOf(none, null)]);
  });

  it('takes every one of the ten relations', async () => {
    const phone = world.phone();
    await registered(world, reception, { contactPhone: phone });
    for (const relation of [
      'son',
      'daughter',
      'husband',
      'wife',
      'father',
      'mother',
      'brother',
      'sister',
      'other',
    ]) {
      expect((await registered(world, reception, { contactPhone: phone, relation })).relation).toBe(
        relation,
      );
    }
  });

  it('refuses a second holder, a relation on a new phone and an unknown relation', async () => {
    const phone = world.phone();
    await registered(world, reception, { contactPhone: phone });
    const second = await register(world, reception, chartInput(phone, { relation: 'holder' }));
    expect(second.statusCode, second.body).toBe(400);
    expect(second.json()).toMatchObject({ error: { details: [{ path: 'body.relation' }] } });
    const lone = await register(world, reception, chartInput(world.phone(), { relation: 'son' }));
    expect(lone.statusCode).toBe(400);
    expect(lone.json()).toMatchObject({ error: { details: [{ path: 'body.relation' }] } });
    const unknown = await register(world, reception, chartInput(phone, { relation: 'cousin' }));
    expect(unknown.statusCode).toBe(400);
  });

  it('leaves out archived charts and other clinics’ charts', async () => {
    const phone = world.phone();
    const holder = await registered(world, reception, { contactPhone: phone });
    const gone = await registered(world, reception, { contactPhone: phone, relation: 'son' });
    await archive(world, clinic.owner.cookie, gone.id, gone.updatedAt);
    await registered(world, other.owner.cookie, { contactPhone: phone });
    expect(await family(phone)).toEqual({ holder: cardOf(holder, 'holder'), members: [] });
  });

  it('answers 400 on an incomplete phone, 403 to the accountant, and writes no audit', async () => {
    const before = (await patientAudit(clinic)).length;
    const bad = await familyOf(world, reception, { phone: '0912' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: { details: [{ path: 'body.phone' }] } });
    expect((await familyOf(world, accountant, { phone: world.phone() })).statusCode).toBe(403);
    await family(world.phone());
    expect((await patientAudit(clinic)).length).toBe(before);
    expect(codeOf(bad)).toBe('validation_failed');
  });
});

describe('a phone change moves the chart (criterion 9)', () => {
  it('to a new phone: the chart becomes its holder and leaves the old family', async () => {
    const phone = world.phone();
    const holder = await registered(world, reception, { contactPhone: phone });
    const son = await registered(world, reception, { contactPhone: phone, relation: 'son' });
    const fresh = world.phone();
    const res = await edit(world, reception, son.id, {
      expectedUpdatedAt: son.updatedAt,
      contactPhone: fresh,
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<ChartBody>()).toMatchObject({ relation: 'holder', family: [] });
    expect((await family(phone)).members).toEqual([]);
    expect((await family(fresh)).holder?.id).toBe(son.id);
    expect((await chartOf(world, reception, holder.id)).json<ChartBody>().family).toEqual([]);
  });

  it('to a phone with a family: it joins with the relation given, else none', async () => {
    const phone = world.phone();
    const holder = await registered(world, reception, { contactPhone: phone });
    const mover = await registered(world, reception, {});
    const res = await edit(world, reception, mover.id, {
      expectedUpdatedAt: mover.updatedAt,
      contactPhone: phone,
      relation: 'wife',
    });
    expect(res.statusCode, res.body).toBe(200);
    const moved = res.json<ChartBody>();
    expect(moved.relation).toBe('wife');
    expect(moved.family).toEqual([cardOf(holder, 'holder')]);
    const another = await registered(world, reception, {});
    const plain = await edit(world, reception, another.id, {
      expectedUpdatedAt: another.updatedAt,
      contactPhone: phone,
    });
    expect(plain.json<ChartBody>().relation).toBeNull();
  });

  it('a relation alone can be changed, with the same rules', async () => {
    const phone = world.phone();
    await registered(world, reception, { contactPhone: phone });
    const member = await registered(world, reception, { contactPhone: phone, relation: 'son' });
    const res = await edit(world, reception, member.id, {
      expectedUpdatedAt: member.updatedAt,
      relation: 'brother',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<ChartBody>().relation).toBe('brother');
    const audit = (await patientAudit(clinic)).filter(
      (r) => r.event === 'patient.edited' && r.targetId === member.id,
    );
    expect(audit.at(-1)?.data).toEqual({ relation: true });
    const twice = await edit(world, reception, member.id, {
      expectedUpdatedAt: res.json<ChartBody>().updatedAt,
      relation: 'holder',
    });
    expect(twice.statusCode).toBe(400);
  });
});

describe('search results carry the family (contract `POST /patients/search`)', () => {
  it('`familySize` counts the active charts on the phone, `relation` the chart’s', async () => {
    const phone = world.phone();
    await registered(world, reception, {
      contactPhone: phone,
      givenName: 'تيماء',
      familyName: 'البيطار',
    });
    await registered(world, reception, { contactPhone: phone, relation: 'sister' });
    const alone = await registered(world, reception, {
      givenName: 'تيماء',
      familyName: 'النحاس',
    });
    const { results } = await found(world, reception, 'تيماء');
    const byPhone = results.find((r) => r.contactPhone === phone);
    expect(byPhone).toMatchObject({ familySize: 2, relation: 'holder' });
    expect(results.find((r) => r.id === alone.id)).toMatchObject({
      familySize: 1,
      relation: 'holder',
    });
  });
});
