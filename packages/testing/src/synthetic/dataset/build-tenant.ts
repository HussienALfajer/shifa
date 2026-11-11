/** Builds one tenant (organization, branches, staff, households and charts) from a plan. */
import type { IdRegistry } from '../ids.ts';
import { CURRENCIES, type Currency, generatePrice } from '../money.ts';
import { TURKMEN_FAMILY_NAMES } from '../names/lists.ts';
import { generatePersonName, type PersonName, type Sex } from '../names/person-name.ts';
import type { PhoneRegistry } from '../phones.ts';
import type { Random } from '../random.ts';
import { branchName, clinicName } from './clinic-names.ts';
import type {
  City,
  PriceListEntry,
  SyntheticBranch,
  SyntheticOrganization,
  SyntheticPatientAccount,
  SyntheticPractitioner,
  SyntheticTenant,
  TenantKind,
} from './model.ts';
import { accountPhoneCountry, birthDate, holderAgeRange, uniquePhone } from './people.ts';
import type { DatasetSink } from './sink.ts';

/** A patient placed on purpose (an edge case): a single-person account with these name parts. */
export interface PinnedPatient {
  readonly sex?: Sex;
  readonly name: Partial<PersonName>;
}

export interface TenantPlan {
  readonly kind: TenantKind;
  readonly city: City;
  readonly branches: number;
  readonly practitioners: number;
  /** Charts in the tenant: account holders plus dependents. */
  readonly patients: number;
  /** Placed first, before random households. */
  readonly pinned?: readonly PinnedPatient[];
}

export interface DatasetContext {
  readonly ids: IdRegistry;
  readonly phones: PhoneRegistry;
  readonly nowMs: number;
  readonly sink: DatasetSink;
}

export interface TenantBuild {
  readonly tenant: SyntheticTenant;
  readonly organization: SyntheticOrganization;
  readonly branches: readonly SyntheticBranch[];
  readonly practitioners: readonly SyntheticPractitioner[];
  readonly accounts: readonly SyntheticPatientAccount[];
  /** Charts numbered so far in the organization; the next MRN is `formatMrn(mrnCount + 1)`. */
  readonly mrnCount: number;
}

export const formatMrn = (counter: number): string => String(counter).padStart(6, '0');

const SERVICE_CODES = ['CONSULT', 'CHECKUP', 'XRAY', 'CLEANING', 'FILLING', 'EXTRACTION'] as const;
/** Share of Azaz branches that also take Syrian pounds. */
const AZAZ_SYP_SHARE = 0.4;
const MALE_PRACTITIONER_SHARE = 0.6;
const DEPENDENT_COUNTS: readonly (readonly [number, number])[] = [
  [0, 0.5],
  [1, 0.2],
  [2, 0.2],
  [3, 0.1],
];

const branchCurrencies = (random: Random, city: City): Currency[] => {
  const enabled = new Set<Currency>(['USD', city === 'aleppo' ? 'SYP' : 'TRY']);
  if (city === 'azaz' && random.chance(AZAZ_SYP_SHARE)) enabled.add('SYP');
  return CURRENCIES.filter((currency) => enabled.has(currency));
};

const priceList = (random: Random, currencies: readonly Currency[]): PriceListEntry[] =>
  SERVICE_CODES.flatMap((code) =>
    currencies.map((currency) => ({
      code,
      price: generatePrice(random.fork(code).fork(currency), currency),
    })),
  );

export const buildTenant = (
  random: Random,
  plan: TenantPlan,
  context: DatasetContext,
): TenantBuild => {
  const { ids, phones, nowMs, sink } = context;
  const region = plan.city;

  const practitioners: SyntheticPractitioner[] = [];
  for (let index = 0; index < plan.practitioners; index += 1) {
    const stream = random.fork('practitioners').fork(String(index));
    const sex: Sex = stream.fork('sex').chance(MALE_PRACTITIONER_SHARE) ? 'male' : 'female';
    const country = region === 'azaz' && stream.fork('country').chance(0.5) ? 'TR' : 'SY';
    practitioners.push({
      id: ids.next(stream.fork('id')),
      name: generatePersonName(stream.fork('name'), { sex, adult: true, region }),
      sex,
      phone: uniquePhone(phones, stream.fork('phone'), country),
    });
  }
  const doctor =
    practitioners[0]?.name ??
    generatePersonName(random.fork('doctor'), {
      sex: 'male',
      adult: true,
      region,
    });

  const name = clinicName(random.fork('clinic-name'), plan.kind, plan.city, doctor);
  const tenant: SyntheticTenant = {
    id: ids.next(random.fork('tenant-id')),
    name,
    kind: plan.kind,
    city: plan.city,
    baseCurrency: 'USD',
  };
  const organization: SyntheticOrganization = {
    id: ids.next(random.fork('organization-id')),
    tenantId: tenant.id,
    name,
  };
  sink.tenants.push(tenant);
  sink.organizations.push(organization);
  sink.practitioners.push(...practitioners);

  const branches: SyntheticBranch[] = [];
  for (let index = 0; index < plan.branches; index += 1) {
    const stream = random.fork('branches').fork(String(index));
    const currencies = branchCurrencies(stream.fork('currencies'), plan.city);
    const branch: SyntheticBranch = {
      id: ids.next(stream.fork('id')),
      tenantId: tenant.id,
      organizationId: organization.id,
      name: branchName(index),
      city: plan.city,
      enabledCurrencies: currencies,
      priceList: priceList(stream.fork('prices'), currencies),
    };
    branches.push(branch);
    const resources = stream.fork('resources');
    const resourceCount = resources.int(1, 3);
    for (let slot = 0; slot < resourceCount; slot += 1) {
      const resource = resources.fork(String(slot));
      const kind = resource.fork('kind').chance(0.5) ? 'chair' : 'room';
      sink.resources.push({
        id: ids.next(resource.fork('id')),
        tenantId: tenant.id,
        branchId: branch.id,
        kind,
        name: `${kind === 'chair' ? 'كرسي' : 'غرفة'} ${String(slot + 1)}`,
      });
    }
  }
  sink.branches.push(...branches);

  // One role per practitioner per branch; the first practitioner of a multi-branch tenant
  // works in two branches of the organization.
  practitioners.forEach((practitioner, index) => {
    const homes = [index % branches.length];
    if (index === 0 && branches.length > 1) homes.push(1);
    for (const branchIndex of homes) {
      const branch = branches[branchIndex];
      if (branch === undefined) continue;
      sink.practitionerRoles.push({
        id: ids.next(random.fork('roles').fork(`${String(index)}:${String(branchIndex)}`)),
        tenantId: tenant.id,
        practitionerId: practitioner.id,
        organizationId: organization.id,
        branchId: branch.id,
      });
    }
  });

  let mrnCount = 0;
  const chart = (stream: Random, accountId: string, dependentId?: string): void => {
    mrnCount += 1;
    sink.charts.push({
      id: ids.next(stream.fork('chart-id')),
      tenantId: tenant.id,
      organizationId: organization.id,
      accountId,
      ...(dependentId === undefined ? {} : { dependentId }),
      mrn: formatMrn(mrnCount),
    });
  };

  const accounts: SyntheticPatientAccount[] = [];
  const pinned = plan.pinned ?? [];
  let patientsLeft = plan.patients;
  for (let household = 0; patientsLeft > 0; household += 1) {
    const stream = random.fork('households').fork(String(household));
    const pin = pinned[household];
    const firstFamily = household === pinned.length;
    // Pinned patients and the tenant's second account live alone; the first family has 2–3
    // children, so every tenant with room holds an account with two or more dependents.
    const wanted =
      pin !== undefined || (household === 1 && !firstFamily)
        ? 0
        : firstFamily
          ? 2 + stream.fork('size').int(0, 1)
          : stream.fork('size').weighted(DEPENDENT_COUNTS);
    const dependentCount = Math.min(wanted, patientsLeft - 1);

    // The first family's holder is a father, so his children carry his family name; in Azaz
    // that name is Turkmen, so every Azaz tenant holds Turkmen family names.
    const sex: Sex =
      pin?.sex ?? (firstFamily ? 'male' : stream.fork('sex').chance(0.5) ? 'male' : 'female');
    const drawn = generatePersonName(stream.fork('name'), { sex, adult: true, region });
    const turkmen = firstFamily && region === 'azaz';
    const name: PersonName = {
      ...drawn,
      ...(turkmen ? { family: stream.fork('turkmen').pick(TURKMEN_FAMILY_NAMES) } : {}),
      ...pin?.name,
    };
    // The second account of every tenant is over 65, so each tenant has all three age groups.
    const range =
      household === 1 && dependentCount === 0
        ? 'senior'
        : holderAgeRange(stream.fork('age-range'), dependentCount > 0);
    const country = accountPhoneCountry(stream.fork('country'), region, accounts.length);
    const account: SyntheticPatientAccount = {
      id: ids.next(stream.fork('id')),
      phone: uniquePhone(phones, stream.fork('phone'), country),
      name,
      sex,
      birthDate: birthDate(stream.fork('birth'), nowMs, range),
    };
    accounts.push(account);
    sink.patientAccounts.push(account);
    chart(stream, account.id);

    for (let member = 0; member < dependentCount; member += 1) {
      const child = stream.fork('dependents').fork(String(member));
      const childSex: Sex = child.fork('sex').chance(0.5) ? 'male' : 'female';
      const childName = generatePersonName(child.fork('name'), {
        sex: childSex,
        adult: false,
        region,
      });
      const dependent = {
        id: ids.next(child.fork('id')),
        accountId: account.id,
        name:
          sex === 'male' ? { ...childName, father: name.given, family: name.family } : childName,
        sex: childSex,
        birthDate: birthDate(child.fork('birth'), nowMs, 'child'),
        relation: 'child' as const,
      };
      sink.dependents.push(dependent);
      chart(child, account.id, dependent.id);
    }
    patientsLeft -= 1 + dependentCount;
  }

  return { tenant, organization, branches, practitioners, accounts, mrnCount };
};
