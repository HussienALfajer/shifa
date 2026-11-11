// Spec 0.2-08 criteria 4, 5 and 6: tenancy shape and referential integrity over seeds 1–50.
import { describe, expect, it } from 'vitest';
import { generateDataset, type SyntheticDataset } from '../../src/index.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SEEDS = Array.from({ length: 50 }, (_, index) => index + 1);

const byId = <T extends { id: string }>(records: readonly T[]): Map<string, T> =>
  new Map(records.map((record) => [record.id, record]));

/** Returns every integrity problem found; an empty list means the dataset is sound. */
const walk = (dataset: SyntheticDataset): string[] => {
  const problems: string[] = [];
  const fail = (message: string): void => {
    problems.push(message);
  };

  const all = [
    ...dataset.tenants,
    ...dataset.organizations,
    ...dataset.branches,
    ...dataset.resources,
    ...dataset.practitioners,
    ...dataset.practitionerRoles,
    ...dataset.patientAccounts,
    ...dataset.dependents,
    ...dataset.charts,
  ];
  const seen = new Set<string>();
  for (const record of all) {
    if (!UUID_V4.test(record.id)) fail(`id not UUID-format: ${record.id}`);
    if (seen.has(record.id)) fail(`duplicate id: ${record.id}`);
    seen.add(record.id);
  }

  const tenants = byId(dataset.tenants);
  const organizations = byId(dataset.organizations);
  const branches = byId(dataset.branches);
  const practitioners = byId(dataset.practitioners);
  const accounts = byId(dataset.patientAccounts);
  const dependents = byId(dataset.dependents);

  for (const global of [
    ...dataset.practitioners,
    ...dataset.patientAccounts,
    ...dataset.dependents,
  ]) {
    if ('tenantId' in global) fail(`global record ${global.id} carries tenantId`);
  }
  for (const organization of dataset.organizations) {
    if (!tenants.has(organization.tenantId)) fail(`organization ${organization.id}: no tenant`);
  }
  for (const branch of dataset.branches) {
    const organization = organizations.get(branch.organizationId);
    if (organization?.tenantId !== branch.tenantId) fail(`branch ${branch.id}: org tenant`);
    if (tenants.get(branch.tenantId)?.city !== branch.city) fail(`branch ${branch.id}: city`);
  }
  for (const resource of dataset.resources) {
    if (branches.get(resource.branchId)?.tenantId !== resource.tenantId) {
      fail(`resource ${resource.id}: branch tenant`);
    }
  }
  for (const role of dataset.practitionerRoles) {
    if (!practitioners.has(role.practitionerId)) fail(`role ${role.id}: no practitioner`);
    if (organizations.get(role.organizationId)?.tenantId !== role.tenantId) {
      fail(`role ${role.id}: org tenant`);
    }
    const branch = branches.get(role.branchId);
    if (branch?.organizationId !== role.organizationId || branch.tenantId !== role.tenantId) {
      fail(`role ${role.id}: branch outside its organization`);
    }
  }
  const roleKeys = new Set<string>();
  for (const role of dataset.practitionerRoles) {
    const key = `${role.practitionerId}|${role.branchId}`;
    if (roleKeys.has(key)) fail(`role ${role.id}: second role in one branch`);
    roleKeys.add(key);
  }
  for (const dependent of dataset.dependents) {
    if (!accounts.has(dependent.accountId)) fail(`dependent ${dependent.id}: no account`);
  }

  const chartKeys = new Set<string>();
  const mrns = new Set<string>();
  for (const chart of dataset.charts) {
    if (organizations.get(chart.organizationId)?.tenantId !== chart.tenantId) {
      fail(`chart ${chart.id}: org tenant`);
    }
    if (!accounts.has(chart.accountId)) fail(`chart ${chart.id}: no account`);
    if (chart.dependentId !== undefined) {
      if (dependents.get(chart.dependentId)?.accountId !== chart.accountId) {
        fail(`chart ${chart.id}: dependent of another account`);
      }
    }
    const key = `${chart.organizationId}|${chart.accountId}|${chart.dependentId ?? '-'}`;
    if (chartKeys.has(key)) fail(`chart ${chart.id}: second chart for one person in one org`);
    chartKeys.add(key);
    const mrn = `${chart.organizationId}|${chart.mrn}`;
    if (mrns.has(mrn)) fail(`chart ${chart.id}: MRN repeated in its organization`);
    mrns.add(mrn);
  }

  for (const tenant of dataset.tenants) {
    const orgs = dataset.organizations.filter(
      (organization) => organization.tenantId === tenant.id,
    );
    const tenantBranches = dataset.branches.filter((branch) => branch.tenantId === tenant.id);
    const tenantPractitioners = new Set(
      dataset.practitionerRoles
        .filter((role) => role.tenantId === tenant.id)
        .map((role) => role.practitionerId),
    );
    if (orgs.length === 0 || tenantBranches.length === 0) fail(`tenant ${tenant.id}: empty`);
    if (tenant.kind === 'solo') {
      if (orgs.length !== 1) fail(`solo tenant ${tenant.id}: ${String(orgs.length)} orgs`);
      if (tenantBranches.length !== 1) fail(`solo tenant ${tenant.id}: branches`);
      if (tenantPractitioners.size !== 1) fail(`solo tenant ${tenant.id}: practitioners`);
    }
  }
  return problems;
};

const tenantsPerPractitioner = (dataset: SyntheticDataset): number =>
  Math.max(
    ...dataset.practitioners.map(
      (practitioner) =>
        new Set(
          dataset.practitionerRoles
            .filter((role) => role.practitionerId === practitioner.id)
            .map((role) => role.tenantId),
        ).size,
    ),
  );

describe('dataset integrity', () => {
  it('minimal: sound for seeds 1–50', () => {
    for (const seed of SEEDS) {
      expect(walk(generateDataset({ seed, preset: 'minimal' })), `seed ${String(seed)}`).toEqual(
        [],
      );
    }
  });

  it('demo: sound for seeds 1–50, with a practitioner in two tenants', () => {
    for (const seed of SEEDS) {
      const dataset = generateDataset({ seed, preset: 'demo' });
      expect(walk(dataset), `seed ${String(seed)}`).toEqual([]);
      expect(tenantsPerPractitioner(dataset)).toBeGreaterThanOrEqual(2);
    }
  });

  it('load with small parameters: sound', () => {
    const dataset = generateDataset({
      seed: 9,
      preset: 'load',
      load: { tenants: 9, patientsPerTenant: 60 },
    });
    expect(walk(dataset)).toEqual([]);
  });

  it('the walker catches a broken foreign key and a repeated MRN', () => {
    const dataset = generateDataset({ seed: 1, preset: 'minimal' });
    const [first, second] = dataset.charts;
    if (first === undefined || second === undefined) throw new Error('need two charts');
    const broken: SyntheticDataset = {
      ...dataset,
      charts: [
        { ...first, accountId: '00000000-0000-4000-8000-000000000000' },
        ...dataset.charts.slice(1),
      ],
    };
    expect(walk(broken).some((problem) => problem.includes('no account'))).toBe(true);
    const repeated: SyntheticDataset = {
      ...dataset,
      charts: [first, { ...second, organizationId: first.organizationId, mrn: first.mrn }],
    };
    expect(walk(repeated).some((problem) => problem.includes('MRN'))).toBe(true);
  });
});
