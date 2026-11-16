// Garage (ADR-0021) for the spike: single node on the internal network, one bucket and one key
// per tenant (criterion 5). Keys are created per run and held in memory only.
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AwsClient } from 'aws4fetch';
import { execIn, runContainer } from './containers.ts';
import { waitFor } from './docker.ts';
import { IMAGES } from './images.ts';
import type { ExecResult, S3Credentials } from './types.ts';

export const GARAGE_REGION = 'garage';

/** A path-style S3 client signed with the given key (Garage region `garage`). */
export const s3Client = (credentials: S3Credentials): AwsClient =>
  new AwsClient({ ...credentials, service: 's3', region: GARAGE_REGION });

const CONFIG = `metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"

[s3_api]
s3_region = "${GARAGE_REGION}"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.internal"

[admin]
api_bind_addr = "[::]:3903"
`;

export function parseGarageKey(text: string): S3Credentials {
  const id = /Key ID:\s+(GK[0-9a-f]+)/.exec(text)?.[1];
  const secret = /Secret key:\s+([0-9a-f]{64})/.exec(text)?.[1];
  if (!id || !secret) throw new Error('could not read the Garage key');
  return { accessKeyId: id, secretAccessKey: secret };
}

export interface Garage {
  container: string;
  cli(...args: string[]): Promise<ExecResult>;
  /** Creates the bucket and a key allowed to read and write it only (not owner). */
  tenantBucket(bucket: string): Promise<S3Credentials>;
}

export async function startGarage(options: {
  name: string;
  runId: string;
  network: string;
  runDir: string;
}): Promise<Garage> {
  const config = join(options.runDir, 'garage.toml');
  await writeFile(config, CONFIG);
  const container = await runContainer({
    name: options.name,
    runId: options.runId,
    image: IMAGES.garage,
    networks: [{ network: options.network, aliases: ['garage'] }],
    secretEnv: {
      GARAGE_RPC_SECRET: randomBytes(32).toString('hex'),
      GARAGE_ADMIN_TOKEN: randomBytes(32).toString('base64url'),
    },
    mounts: [[config, '/etc/garage.toml']],
    tmpfs: ['/var/lib/garage/meta', '/var/lib/garage/data'],
  });
  const cli = (...args: string[]) => execIn(container, ['/garage', ...args]);
  const must = async (...args: string[]) => {
    const result = await cli(...args);
    // stderr only: stdout of `key create` holds the secret.
    if (result.code !== 0)
      throw new Error(`garage ${args.slice(0, 2).join(' ')}: ${result.stderr.slice(0, 300)}`);
    return result;
  };
  await waitFor('garage', async () => (await cli('status')).code === 0, 120_000);
  const node = /^([0-9a-f]{16,})/m.exec((await must('node', 'id', '-q')).stdout)?.[1];
  if (!node) throw new Error('garage node id not found');
  await must('layout', 'assign', '-z', 'dc1', '-c', '20G', node.slice(0, 16));
  await must('layout', 'apply', '--version', '1');
  return {
    container,
    cli,
    tenantBucket: async (bucket) => {
      await must('bucket', 'create', bucket);
      const key = parseGarageKey((await must('key', 'create', `${bucket}-key`)).stdout);
      await must('bucket', 'allow', '--read', '--write', bucket, '--key', key.accessKeyId);
      return key;
    },
  };
}
