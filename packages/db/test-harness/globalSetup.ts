// Vitest globalSetup: one PostgreSQL container per run, roles + migrations applied once into
// `shifa_template`; workers clone it (setup.ts). Ryuk removes the container if the run crashes.
import { randomBytes } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { migrate } from '../src/migrate.ts';
import { applyRoles, type HarnessInfo, urlFor, withPool } from './context.ts';
import { explainStartFailure } from './docker.ts';
import { acquireDbTestLock } from './guard.ts';
import { POSTGRES_IMAGE, RYUK_IMAGE } from './image.ts';

const secret = () => randomBytes(16).toString('hex');

async function startContainer(superuserPassword: string): Promise<StartedPostgreSqlContainer> {
  process.env['RYUK_CONTAINER_IMAGE'] ??= RYUK_IMAGE;
  try {
    return await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withUsername('postgres')
      .withPassword(superuserPassword)
      .withDatabase('postgres')
      // Throw-away data: skip durability for speed.
      .withTmpFs({ '/var/lib/postgresql': 'rw' })
      .withCommand(['postgres', '-c', 'fsync=off', '-c', 'synchronous_commit=off'])
      .start();
  } catch (err) {
    throw explainStartFailure(err);
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const release = await acquireDbTestLock();
  let container: StartedPostgreSqlContainer | undefined;
  try {
    const superuserPassword = secret();
    container = await startContainer(superuserPassword);
    const info: HarnessInfo = {
      host: container.getHost(),
      port: container.getPort(),
      superuserPassword,
      ownerPassword: secret(),
      appPassword: secret(),
    };
    await applyRoles(info);
    await withPool(urlFor(info, 'superuser', 'postgres'), (pool) =>
      pool.query('CREATE DATABASE shifa_template OWNER shifa_owner'),
    );
    await migrate(urlFor(info, 'owner', 'shifa_template'));
    project.provide('shifaDb', info);
  } catch (err) {
    try {
      await container?.stop();
    } finally {
      release();
    }
    throw err;
  }
  const started = container;
  return async () => {
    try {
      await started.stop();
    } finally {
      release();
    }
  };
}
