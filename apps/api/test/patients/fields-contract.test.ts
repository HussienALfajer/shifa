// A-03-05 contract tests (ADR-0047; review B2): every custom field route's answer parses with its
// contract schema, field by field, and its 409s with the error envelope. Contract rows
// `GET /patients/fields`, `GET /patients/fields/definitions`, `POST /patients/fields`,
// `PATCH /patients/fields/:key`, `PUT /patients/fields/order`, archive and restore.
// Review B1: an edit that sends the stored rules unchanged saves nothing (jsonb gives the stored
// keys back in its own order) and writes no audit row; a real rule change names `validation`.
import {
  ErrorEnvelope,
  PatientFieldDefinition,
  PatientFieldDefinitions,
  PatientFormFields,
} from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from '../../src/access/index.ts';
import { rolesInScope } from '../../src/modules/patients/fields/fields.controller.ts';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, get, type TeamWorld, teamWorld } from '../team/support.ts';
import {
  archiveField,
  createField,
  editField,
  fieldAudit,
  orderFields,
  restoreField,
  textField,
} from './fields-support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let owner: string;
let reception: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_09);
  clinic = await world.clinic();
  owner = clinic.owner.cookie;
  reception = (await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]))
    .cookie;
});

afterAll(async () => {
  await world.app.app.close();
});

const RULES = {
  minLength: 2,
  maxLength: 12,
  pattern: { preset: 'custom', expression: '[A-Z]{2}[0-9]+' },
};

function definition(res: Awaited<ReturnType<typeof createField>>, status: number) {
  expect(res.statusCode, res.body).toBe(status);
  return PatientFieldDefinition.parse(res.json());
}

describe('the answers parse with their contract schemas', () => {
  it('create, edit, archive, restore: PatientFieldDefinition', async () => {
    const created = definition(
      await createField(
        world.app,
        owner,
        textField({ labelEn: 'Card', validation: RULES, default: 'AB12', required: true }),
      ),
      201,
    );
    expect(created).toMatchObject({
      labelEn: 'Card',
      required: true,
      validation: { ...RULES, min: null, max: null },
      default: 'AB12',
      section: 'معلومات إدارية',
      order: 0,
    });
    const edited = definition(
      await editField(world.app, owner, created.key, {
        expectedUpdatedAt: created.updatedAt,
        print: true,
      }),
      200,
    );
    expect(edited.print).toBe(true);
    const archived = definition(await archiveField(world.app, owner, created.key), 200);
    expect(archived.state).toBe('archived');
    const restored = definition(await restoreField(world.app, owner, created.key), 200);
    expect(restored.state).toBe('active');
  });

  it('the owner’s view, the order and the member’s view', async () => {
    const res = await get(world.app, '/patients/fields/definitions', owner);
    expect(res.statusCode, res.body).toBe(200);
    const list = PatientFieldDefinitions.parse(res.json());
    expect(list.limits).toEqual({ used: 1, max: 20, searchableUsed: 0, searchableMax: 5 });
    expect(list.listUpdatedAt).toBe(list.fields[0]?.updatedAt);
    const ordered = await orderFields(world.app, owner, {
      expectedUpdatedAt: list.listUpdatedAt,
      sections: [{ title: 'معلومات إدارية', keys: list.fields.map((f) => f.key) }],
    });
    expect(ordered.statusCode, ordered.body).toBe(200);
    PatientFieldDefinitions.parse(ordered.json());

    const form = await get(world.app, '/patients/fields', reception);
    expect(form.statusCode, form.body).toBe(200);
    const [field] = PatientFormFields.parse(form.json()).fields;
    expect(field).toEqual({
      key: list.fields[0]?.key,
      label: list.fields[0]?.label,
      type: 'text',
      required: true,
      validation: { ...RULES, min: null, max: null },
      default: 'AB12',
      options: [],
      section: 'معلومات إدارية',
      order: 0,
      editable: true,
      sensitive: false,
    });
  });

  it('409s carry the error envelope', async () => {
    const other = await world.clinic();
    for (let i = 0; i < 5; i += 1) {
      await createField(world.app, other.owner.cookie, textField({ searchable: true }));
    }
    const res = await createField(world.app, other.owner.cookie, textField({ searchable: true }));
    expect(res.statusCode).toBe(409);
    expect(ErrorEnvelope.parse(res.json()).error.code).toBe('searchable_limit');
  });
});

describe('the roles the member’s view counts (security review L1)', () => {
  it('counts tenant-wide roles and the active branch’s, not another branch’s', () => {
    const tenantId = clinic.clinicId;
    const principal = {
      roles: [
        { role: 'receptionist', tenantId, branchId: 'b0000000-0000-4000-8000-00000000000a' },
        { role: 'doctor', tenantId, branchId: 'b0000000-0000-4000-8000-00000000000b' },
        { role: 'accountant', tenantId, branchId: null },
      ],
    } as unknown as Principal;
    const scope = {
      tenantId,
      branchId: 'b0000000-0000-4000-8000-00000000000a',
      userId: 'u0000000-0000-4000-8000-000000000001',
    };
    expect(rolesInScope(principal, scope).sort()).toEqual(['accountant', 'receptionist']);
  });
});

describe('an edit that sends the stored rules (review B1)', () => {
  it('saves nothing when nothing changed, and names `validation` when a rule did', async () => {
    const res = await createField(world.app, owner, textField({ validation: RULES }));
    const field = definition(res, 201);
    const before = (await fieldAudit(clinic)).length;
    const same = definition(
      await editField(world.app, owner, field.key, {
        expectedUpdatedAt: field.updatedAt,
        validation: field.validation,
        label: field.label,
        viewRoles: field.viewRoles,
        editRoles: field.editRoles,
      }),
      200,
    );
    expect(same.updatedAt).toBe(field.updatedAt);
    expect(await fieldAudit(clinic)).toHaveLength(before);

    const changed = definition(
      await editField(world.app, owner, field.key, {
        expectedUpdatedAt: field.updatedAt,
        validation: { ...field.validation, maxLength: 20 },
      }),
      200,
    );
    expect(changed.validation.maxLength).toBe(20);
    const last = (await fieldAudit(clinic)).at(-1);
    expect(last?.data).toEqual({ key: field.key, changed: ['validation'] });
  });
});
