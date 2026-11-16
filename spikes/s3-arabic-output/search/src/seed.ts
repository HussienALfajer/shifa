// The `load` preset's synthetic patients as search rows: one row per chart, with the chart
// holder's (account or dependent) full name as display name. Pure; inserting is the caller's job.
import { fullName, generateDataset, type LoadParams, type PersonName } from '@shifa/testing';

export interface SeedPatient {
  tenantId: string;
  id: string;
  displayName: string;
}

export const SEED = 30_303;

export function syntheticPatients(load: LoadParams, seed: number = SEED): SeedPatient[] {
  const dataset = generateDataset({ seed, preset: 'load', load });
  const names = new Map<string, PersonName>();
  for (const account of dataset.patientAccounts) names.set(account.id, account.name);
  for (const dependent of dataset.dependents) names.set(dependent.id, dependent.name);
  return dataset.charts.map((chart) => {
    const name = names.get(chart.dependentId ?? chart.accountId);
    if (name === undefined) throw new Error(`chart ${chart.id} has no holder`);
    return { tenantId: chart.tenantId, id: chart.id, displayName: fullName(name) };
  });
}
