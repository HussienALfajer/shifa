// OpenAPI drift (registered as `openapi` in scripts/drift.config.mjs): bundles the API's
// generator (apps/api/tsdown.openapi.config.ts), runs it with plain Node and writes the document
// to its repo-relative path under the check's temp directory. Never connects to a database.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const TIMEOUT_MS = 120_000;

function run(cwd, args) {
  return new Promise((resolve) => {
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
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, output }));
    child.on('error', (err) => resolve({ code: 1, signal: null, output: String(err) }));
  });
}

export function openapiCheck({
  apiDir = 'apps/api',
  output = 'packages/contracts/generated/openapi.json',
} = {}) {
  return {
    name: 'openapi',
    inputs: [`${apiDir}/src`, `${apiDir}/scripts/generate-openapi.ts`, 'packages/contracts/src'],
    outputs: [output],
    hint: 'routes or contracts changed: run `node scripts/check-drift.mjs --fix` and commit openapi.json',
    async generate(outDir, { root }) {
      const apiAbs = join(root, apiDir);
      const tsdown = createRequire(join(apiAbs, 'package.json')).resolve('tsdown/run');
      const built = await run(apiAbs, [tsdown, '--config', 'tsdown.openapi.config.ts']);
      if (built.code !== 0) throw new Error(`bundling the generator failed\n${built.output}`);
      const bundle = join(apiAbs, 'node_modules', '.cache', 'openapi', 'generate-openapi.js');
      const generated = await run(apiAbs, [bundle, join(outDir, output)]);
      if (generated.code !== 0) throw new Error(`the generator failed\n${generated.output}`);
      return undefined;
    },
  };
}
