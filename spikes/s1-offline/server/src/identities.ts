// Synthetic users of the spike (PLT-50): two tenants from the `demo` dataset, one branch each,
// its practitioners, one receptionist and the patients charted there. No real data, no passwords.
import { generateDataset } from '@shifa/testing';

export interface TenantIdentity {
  tenantId: string;
  branchId: string;
  practitioners: { id: string; label: string }[];
  receptionist: { userId: string; username: string };
  patients: { id: string }[];
}

export interface Identities {
  A: TenantIdentity;
  B: TenantIdentity;
}

const SEED = 31;

function pick(tenantIndex: number, username: string): TenantIdentity {
  const data = generateDataset({ seed: SEED, preset: 'demo' });
  const tenant = data.tenants[tenantIndex];
  const branch = data.branches.find((b) => b.tenantId === tenant?.id);
  if (!tenant || !branch) throw new Error('synthetic dataset changed: tenant or branch missing');
  const practitioners = data.practitionerRoles
    .filter((r) => r.branchId === branch.id)
    .map((r, i) => ({ id: r.practitionerId, label: `الطبيب ${String(i + 1)}` }));
  const patients = data.charts
    .filter((c) => c.tenantId === tenant.id && c.dependentId === undefined)
    .map((c) => ({ id: c.accountId }));
  // A receptionist id derived from the tenant id keeps the identities deterministic.
  const userId = `${tenant.id.slice(0, 24)}${'0'.repeat(11)}${String(tenantIndex)}`;
  return {
    tenantId: tenant.id,
    branchId: branch.id,
    practitioners,
    receptionist: { userId, username },
    patients,
  };
}

/** Tenant A: a multi-doctor clinic (3 practitioners); tenant B: a multi-branch one. */
export function syntheticIdentities(): Identities {
  return { A: pick(1, 'reception-a'), B: pick(4, 'reception-b') };
}

export function findTenant(ids: Identities, tenantId: string): TenantIdentity | undefined {
  return [ids.A, ids.B].find((t) => t.tenantId === tenantId);
}
