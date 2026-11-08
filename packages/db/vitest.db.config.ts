// Vitest preset for tests against PostgreSQL. Other packages use it as one of their projects:
//   projects: [dbTestProject({ include: ['test/db/**/*.test.ts'] })]
// Needs Docker; see packages/db/CLAUDE.md.
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';

const harness = (file: string) => fileURLToPath(new URL(`./test-harness/${file}`, import.meta.url));

export function dbTestProject(
  options: { name?: string; include?: string[]; exclude?: string[] } = {},
): TestProjectInlineConfiguration {
  return {
    test: {
      name: options.name ?? 'db',
      include: options.include ?? ['test/**/*.test.ts'],
      exclude: [...configDefaults.exclude, ...(options.exclude ?? [])],
      globalSetup: [harness('globalSetup.ts')],
      setupFiles: [harness('setup.ts')],
      hookTimeout: 60_000,
      testTimeout: 20_000,
    },
  };
}

export default defineConfig(dbTestProject());
