// What the global setup hands the test workers, through their environment (never a file): the
// app origins, the database URL for session surgery and the seeded people with their one-time
// setup tokens. Nothing here is logged.

export interface SeededPerson {
  phone: string;
  token: string;
}

export interface Seeded {
  superAdmin: SeededPerson;
  /** A second super admin, for the A-01-07 journeys: enrols through the screens, then seeds. */
  journeyAdmin: SeededPerson;
  clinics: { tenantId: string; owner: SeededPerson }[];
}

export interface RunUrls {
  clinic: string;
  admin: string;
  api: string;
  /** Superuser URL of the harness database the API runs on (throwaway container). */
  database: string;
}

/** The backend's one stdout line once everything answers: this prefix, then JSON. */
export const READY_PREFIX = 'SHIFA_E2E_READY ';

export const RUN_ENV = 'SHIFA_E2E_RUN';
export const SEED_ENV = 'SHIFA_E2E_SEED';

function read(name: string): unknown {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run the journeys through playwright.config.ts`);
  return JSON.parse(value);
}

export const urls = (): RunUrls => read(RUN_ENV) as RunUrls;
export const seeded = (): Seeded => read(SEED_ENV) as Seeded;
