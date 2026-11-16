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

/** Official plugins this spike may switch on through the image's environment variables. */
const ALLOWED_PLUGIN_ENV = new Set([
  'DICOM_WEB_PLUGIN_ENABLED',
  'POSTGRESQL_PLUGIN_ENABLED',
  'AWS_S3_STORAGE_PLUGIN_ENABLED',
  'TRANSFERS_PLUGIN_ENABLED',
  'GDCM_PLUGIN_ENABLED',
]);
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
      StorageEncryption: { Enable: true, MasterKey: [1, KEY_PATH], MaxConcurrentInputSize: 1024 },
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
    env: {
      TRANSFERS_PLUGIN_ENABLED: 'true',
      ORTHANC_EXPLORER_2_ENABLED: 'false',
      VERBOSE_ENABLED: 'false',
      VERBOSE_STARTUP: 'false',
    },
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
  Config: { Env: string[]; Image: string };
}

/** Every reason the container breaks the licence boundary; empty when it holds. */
export function licenceViolations(inspect: InspectForLicence): string[] {
  const problems: string[] = [];
  if (inspect.Config.Image !== IMAGES.orthanc) problems.push(`image ${inspect.Config.Image}`);
  for (const mount of inspect.Mounts) {
    const dest = mount.Destination;
    const isConfig = dest.startsWith(`${CONFIG_DIR}/`) && dest.endsWith('.json');
    const isKey = dest.startsWith(`${KEY_DIR}/`) && dest.endsWith('.key');
    if (mount.Type !== 'bind' || !(isConfig || isKey)) problems.push(`mount ${dest}`);
    if (/\.(py|lua|so|js)$/i.test(dest) || /plugin/i.test(dest)) problems.push(`code ${dest}`);
    if (isConfig && existsSync(mount.Source)) {
      const settings = JSON.parse(readFileSync(mount.Source, 'utf8')) as Record<string, unknown>;
      for (const key of Object.keys(settings)) {
        if (SCRIPTING_SETTINGS.test(key)) problems.push(`setting ${key} in ${dest}`);
      }
    }
  }
  for (const entry of inspect.Config.Env) {
    const [name = '', value = ''] = entry.split(/=(.*)/s);
    // Orthanc's Python and Lua settings in any spelling (the image's own PYTHONUTF8 is not one).
    const scripting = /^ORTHANC__PYTHON|PYTHON_SCRIPT|PYTHON_PLUGIN|LUA/i.test(name);
    if (scripting || /^ORTHANC__PLUGINS/i.test(name) || name === 'ORTHANC_JSON') {
      problems.push(`env ${name}`);
    } else if (
      name.endsWith('_PLUGIN_ENABLED') &&
      value === 'true' &&
      !ALLOWED_PLUGIN_ENV.has(name)
    ) {
      problems.push(`env ${name}`);
    }
  }
  return problems;
}
