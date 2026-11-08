// Vitest globalSetup: one PostgreSQL container per run, roles + migrations applied once into
// `shifa_template`; workers clone it (setup.ts). Ryuk removes the container if the run crashes.
import type { TestProject } from 'vitest/node';
import { type HarnessContainer, startHarnessContainer } from './container.ts';
import { acquireDbTestLock } from './guard.ts';

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const release = await acquireDbTestLock();
  let container: HarnessContainer | undefined;
  try {
    container = await startHarnessContainer();
    project.provide('shifaDb', container.info);
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
