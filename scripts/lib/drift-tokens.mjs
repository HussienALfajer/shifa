// Design-token drift (registered as `tokens` in scripts/drift.config.mjs): runs the tokens build
// with plain Node (Node 24 strips the types) and writes the web theme (packages/tokens/generated)
// the Dart theme file and the Flutter font copies (packages/shifa_ui) under the check's temp
// directory. A token source
// that breaks the schema or a contrast pair makes the build throw, which the runner reports as a
// crash with a log.
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
 * @param {string} [options.pkgDir] repo-relative tokens package directory
 * @param {string} [options.dartOutput] repo-relative generated Dart file
 * @param {string} [options.flutterFonts] repo-relative directory of the Flutter font copies
 * @param {string} [options.generator] build script, repo-relative or absolute (tests run the
 *   real build against a temp copy of the source)
 */
export function tokensCheck({
  pkgDir = 'packages/tokens',
  dartOutput = 'packages/shifa_ui/lib/src/generated/tokens.g.dart',
  flutterFonts = 'packages/shifa_ui/fonts',
  generator,
} = {}) {
  return {
    name: 'tokens',
    inputs: [`${pkgDir}/src`, `${pkgDir}/scripts`, `${pkgDir}/fonts`],
    outputs: [`${pkgDir}/generated`, dartOutput, flutterFonts],
    hint: 'design tokens or fonts changed: run `node scripts/check-drift.mjs --fix` and commit packages/tokens/generated, the Dart tokens file and packages/shifa_ui/fonts',
    async generate(outDir, { root }) {
      const script = resolve(root, generator ?? `${pkgDir}/scripts/build.ts`);
      const result = await run(root, [script, outDir, join(root, pkgDir, 'src')]);
      if (result.code !== 0) throw new Error(`the tokens build failed\n${result.output}`);
    },
  };
}
