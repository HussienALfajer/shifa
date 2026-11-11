/**
 * Record types of a synthetic dataset. They follow the tenancy model (PLT-01 to PLT-07) and are
 * local to `@shifa/testing` because no domain schemas exist yet: each Phase A slice that adds a
 * table maps the matching type into its insert helper.
 *
 * Tenant-scoped records carry `tenantId`. Practitioners, patient accounts and dependents are
 * global (no `tenantId`): they reach a tenant through practitioner roles and charts.
 */
import type { Currency, Money } from '../money.ts';
import type { PersonName, Region, Sex } from '../names/person-name.ts';

export type TenantKind = 'solo' | 'multi-doctor' | 'multi-branch';
export type City = Region;
export type ResourceKind = 'room' | 'chair';
export type DependentRelation = 'child';
export type DatasetPreset = 'minimal' | 'demo' | 'load';

export interface SyntheticTenant {
  readonly id: string;
  readonly name: string;
  readonly kind: TenantKind;
  readonly city: City;
  readonly baseCurrency: 'USD';
}

export interface SyntheticOrganization {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
}

export interface PriceListEntry {
  /** Service code, unique per currency within a branch. */
  readonly code: string;
  readonly price: Money;
}

export interface SyntheticBranch {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly city: City;
  /** In `CURRENCIES` order. */
  readonly enabledCurrencies: readonly Currency[];
  readonly priceList: readonly PriceListEntry[];
}

export interface SyntheticResource {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly kind: ResourceKind;
  readonly name: string;
}

/** Global: one person who may hold roles in several tenants (PLT-05). */
export interface SyntheticPractitioner {
  readonly id: string;
  readonly name: PersonName;
  readonly sex: Sex;
  readonly phone: string;
}

export interface SyntheticPractitionerRole {
  readonly id: string;
  readonly tenantId: string;
  readonly practitionerId: string;
  readonly organizationId: string;
  readonly branchId: string;
}

/** Global: the phone holder (PLT-07); the phone is unique within a dataset. */
export interface SyntheticPatientAccount {
  readonly id: string;
  readonly phone: string;
  readonly name: PersonName;
  readonly sex: Sex;
  /** YYYY-MM-DD, derived from the dataset clock. */
  readonly birthDate: string;
}

/** Global: a family member on an account's phone. */
export interface SyntheticDependent {
  readonly id: string;
  readonly accountId: string;
  readonly name: PersonName;
  readonly sex: Sex;
  readonly birthDate: string;
  readonly relation: DependentRelation;
}

/** One per person per organization; `dependentId` absent means the account holder's chart. */
export interface SyntheticChart {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly accountId: string;
  readonly dependentId?: string;
  /** Unique within the organization. */
  readonly mrn: string;
}

export interface SyntheticDataset {
  readonly seed: number;
  readonly preset: DatasetPreset;
  /** ISO 8601 instant from the dataset clock. */
  readonly generatedAt: string;
  readonly tenants: readonly SyntheticTenant[];
  readonly organizations: readonly SyntheticOrganization[];
  readonly branches: readonly SyntheticBranch[];
  readonly resources: readonly SyntheticResource[];
  readonly practitioners: readonly SyntheticPractitioner[];
  readonly practitionerRoles: readonly SyntheticPractitionerRole[];
  readonly patientAccounts: readonly SyntheticPatientAccount[];
  readonly dependents: readonly SyntheticDependent[];
  readonly charts: readonly SyntheticChart[];
}
