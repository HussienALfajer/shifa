// Orthanc per tenant (criteria 2–5): generated configuration JSON, the container, and the
// licence-boundary check (IMG-04: only configuration JSON and storage master-key files are
// mounted; no script, no extra plugin, no scripting environment).
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execIn, runContainer } from './containers.ts';
import { waitFor } from './docker.ts';
import { IMAGES } from './images.ts';
import type { S3Credentials } from './types.ts';

export const CONFIG_DIR = '/etc/orthanc';
export const KEY_DIR = '/etc/orthanc-keys';
const CONFIG_PATH = `${CONFIG_DIR}/s4.json`;
const KEY_PATH = `${KEY_DIR}/master.key`;

/** The harness's environment for every Orthanc (no secrets: those are in the JSON). */
export const ORTHANC_ENV = {
  TRANSFERS_PLUGIN_ENABLED: 'true',
  ORTHANC_EXPLORER_2_ENABLED: 'false',
  VERBOSE_ENABLED: 'false',
  VERBOSE_STARTUP: 'false',
} as const;
/** Root settings that load code or more plugins; refused in any mounted JSON. */
const SCRIPTING_SETTINGS = /^(PythonScript|LuaScripts|Plugins|Python|Lua|LuaHeartBeatPeriod)$/i;

export interface OrthancTenant {
  id: string;
  database: string;
  dbPassword: string;
  /** Password of the `gateway` HTTP user (the only user). */
  httpPassword: string;
  bucket: string;
  s3: S3Credentials;
  /** Storage encryption (criterion 4). Off only in the bench's overhead comparison. */
  encrypted?: boolean;
}

export function orthancConfig(t: OrthancTenant): object {
  return {
    Name: `s4-${t.id}`,
    RemoteAccessAllowed: true,
    AuthenticationEnabled: true,
    RegisteredUsers: { gateway: t.httpPassword },
    DicomServerEnabled: false,
    StorageCompression: false,
    PostgreSQL: {
      EnableIndex: true,
      EnableStorage: false,
      Host: 'postgres',
      Port: 5432,
      Database: t.database,
      Username: t.database,
      Password: t.dbPassword,
      EnableSsl: false,
      Lock: false,
      // The plugin's default pool is large; two tenants share one server here.
      IndexConnectionsCount: 10,
    },
    AwsS3Storage: {
      BucketName: t.bucket,
      Region: 'garage',
      Endpoint: 'http://garage:3900',
      AccessKey: t.s3.accessKeyId,
      SecretKey: t.s3.secretAccessKey,
      VirtualAddressing: false,
      StorageStructure: 'flat',
      // Encryption is on from the first write (criterion 4).
      StorageEncryption: {
        Enable: t.encrypted !== false,
        MasterKey: [1, KEY_PATH],
        MaxConcurrentInputSize: 1024,
      },
    },
    DicomWeb: { Enable: true, Root: '/dicom-web/', EnableWado: false },
  };
}

/** Writes the tenant's config and key files into `dir`; returns the host paths. */
export async function writeOrthancFiles(
  dir: string,
  tenant: OrthancTenant,
  masterKey: Buffer,
): Promise<{ config: string; key: string }> {
  const config = join(dir, `orthanc-${tenant.id}.json`);
  const key = join(dir, `orthanc-${tenant.id}.key`);
  await writeFile(config, JSON.stringify(orthancConfig(tenant), null, 2));
  await writeFile(key, masterKey.toString('base64'));
  return { config, key };
}

export async function startOrthanc(options: {
  name: string;
  runId: string;
  tenant: OrthancTenant;
  network: string;
  files: { config: string; key: string };
}): Promise<string> {
  const { name, tenant, files } = options;
  await runContainer({
    name,
    runId: options.runId,
    image: IMAGES.orthanc,
    networks: [{ network: options.network, aliases: [`orthanc-${tenant.id}`] }],
    env: { ...ORTHANC_ENV },
    mounts: [
      [files.config, CONFIG_PATH],
      [files.key, KEY_PATH],
    ],
    // The image declares a volume for the file storage it does not use here.
    tmpfs: ['/var/lib/orthanc/db'],
  });
  await waitOrthanc(name, tenant.httpPassword);
  return name;
}

/** Waits until Orthanc answers /system with the gateway credential (from inside). */
export async function waitOrthanc(name: string, password: string): Promise<void> {
  const probe = [
    'python3',
    '-c',
    'import base64,os,sys,urllib.request as u;' +
      'r=u.Request("http://127.0.0.1:8042/system",headers={"Authorization":"Basic "+base64.b64encode(b"gateway:"+sys.stdin.read().encode()).decode()});' +
      'u.urlopen(r,timeout=2)',
  ];
  await waitFor(
    `orthanc ${name}`,
    async () => (await execIn(name, probe, password)).code === 0,
    180_000,
  );
}

/** The parts of `docker inspect` the licence check reads. */
export interface InspectForLicence {
  Mounts: { Source: string; Destination: string; Type: string }[];
  Config: { Env: string[]; Image: string; Entrypoint?: string[] | null; Cmd?: string[] | null };
}

/**
 * The only environment an Orthanc may run with: the pinned image's own variables and the
 * harness's switches, with these exact values. Anything else (BEFORE_ORTHANC_STARTUP_SCRIPT,
 * Python or Lua settings, ORTHANC_JSON, other plugins) breaks the boundary.
 */
const ALLOWED_ENV = new Set([
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  'PYTHONUTF8=1',
  'LANG=C.UTF-8',
  'SSL_CERT_DIR=/etc/ssl/certs',
  ...Object.entries(ORTHANC_ENV).map(([name, value]) => `${name}=${value}`),
]);
/** The pinned image's entrypoint and command; an override could run anything. */
const ENTRYPOINT = JSON.stringify(['/docker-entrypoint.sh']);
const CMD = JSON.stringify(['/tmp/orthanc.json']);

/** Every reason the container breaks the licence boundary; empty when it holds. */
export function licenceViolations(inspect: InspectForLicence): string[] {
  const problems: string[] = [];
  const { Config: config } = inspect;
  if (config.Image !== IMAGES.orthanc) problems.push(`image ${config.Image}`);
  if (JSON.stringify(config.Entrypoint ?? null) !== ENTRYPOINT) problems.push('entrypoint');
  if (JSON.stringify(config.Cmd ?? null) !== CMD) problems.push('command');
  for (const mount of inspect.Mounts) {
    const dest = mount.Destination;
    const isConfig = dest.startsWith(`${CONFIG_DIR}/`) && dest.endsWith('.json');
    const isKey = dest.startsWith(`${KEY_DIR}/`) && dest.endsWith('.key');
    if (mount.Type !== 'bind' || !(isConfig || isKey)) problems.push(`mount ${dest}`);
    if (/\.(py|lua|so|js)$/i.test(dest) || /plugin/i.test(dest)) problems.push(`code ${dest}`);
    if (isConfig) problems.push(...configProblems(mount.Source, dest));
  }
  for (const entry of config.Env) {
    if (!ALLOWED_ENV.has(entry)) problems.push(`env ${entry.split('=')[0] ?? ''}`);
  }
  return problems;
}

/** A mounted JSON must be readable, parse to an object and set no scripting or plugin key. */
function configProblems(source: string, dest: string): string[] {
  if (!existsSync(source)) return [`unreadable ${dest}`];
  try {
    const settings: unknown = JSON.parse(readFileSync(source, 'utf8'));
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      return [`not a settings object ${dest}`];
    }
    return Object.keys(settings)
      .filter((key) => SCRIPTING_SETTINGS.test(key))
      .map((key) => `setting ${key} in ${dest}`);
  } catch {
    return [`not JSON ${dest}`];
  }
}
