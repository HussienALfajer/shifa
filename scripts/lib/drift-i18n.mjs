// Translation drift (registered as `i18n` in scripts/drift.config.mjs): runs the i18n generator
// with plain Node (Node 24 strips the types, no bundling) and writes packages/i18n/generated
// (keys.ts and arb/app_ar.arb) under the check's temp directory.
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const TIMEOUT_MS = 60_000;

function run(cwd, args) {
  return new Promise((done) => {
    const child = spawn(process.execPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: TIMEOUT_MS,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    let output = '';
    child.stdout.on('data', (d) => {
      output += d;
    });
    child.stderr.on('data', (d) => {
      output += d;
    });
    child.on('close', (code) => done({ code: code ?? 1, output }));
    child.on('error', (err) => done({ code: 1, output: String(err) }));
  });
}

/**
 * @param {object} [options]
 * @param {string} [options.pkgDir] repo-relative package directory
 * @param {string} [options.generator] generator script, repo-relative or absolute (tests run the
 *   real generator against a temp copy of the source)
 */
export function i18nCheck({ pkgDir = 'packages/i18n', generator } = {}) {
  const output = `${pkgDir}/generated`;
  return {
    name: 'i18n',
    inputs: [`${pkgDir}/src`, `${pkgDir}/scripts`, 'packages/contracts/src/errors.ts'],
    outputs: [output],
    hint: 'translations changed: run `node scripts/check-drift.mjs --fix` and commit packages/i18n/generated',
    async generate(outDir, { root }) {
      const script = resolve(root, generator ?? `${pkgDir}/scripts/generate.ts`);
      const locales = join(root, pkgDir, 'src', 'locales');
      const result = await run(root, [script, join(outDir, output), locales]);
      if (result.code !== 0) throw new Error(`the i18n generator failed\n${result.output}`);
    },
  };
}
