import type {
  SyntheticBranch,
  SyntheticChart,
  SyntheticDependent,
  SyntheticOrganization,
  SyntheticPatientAccount,
  SyntheticPractitioner,
  SyntheticPractitionerRole,
  SyntheticResource,
  SyntheticTenant,
} from './model.ts';

/** Mutable record lists a dataset is built into, in generation order. */
export interface DatasetSink {
  readonly tenants: SyntheticTenant[];
  readonly organizations: SyntheticOrganization[];
  readonly branches: SyntheticBranch[];
  readonly resources: SyntheticResource[];
  readonly practitioners: SyntheticPractitioner[];
  readonly practitionerRoles: SyntheticPractitionerRole[];
  readonly patientAccounts: SyntheticPatientAccount[];
  readonly dependents: SyntheticDependent[];
  readonly charts: SyntheticChart[];
}

export const createSink = (): DatasetSink => ({
  tenants: [],
  organizations: [],
  branches: [],
  resources: [],
  practitioners: [],
  practitionerRoles: [],
  patientAccounts: [],
  dependents: [],
  charts: [],
});
