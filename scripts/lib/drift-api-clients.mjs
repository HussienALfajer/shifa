// Drift checks for the API clients generated from the committed OpenAPI document
// (registered as `api-client-ts` and `api-client-dart` in scripts/drift.config.mjs).
// Both read packages/contracts/generated/openapi.json, never the API source.
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const OPENAPI = 'packages/contracts/generated/openapi.json';
const TIMEOUT_MS = 600_000;

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
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
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    child.on('error', (err) => resolve({ code: 1, output: String(err) }));
  });
}

async function mustRun(step, cmd, args, cwd) {
  const result = await run(cmd, args, cwd);
  if (result.code !== 0) throw new Error(`${step} failed\n${result.output}`);
}

/** openapi-typescript → packages/api-client-ts/src/generated/schema.ts */
export function apiClientTsCheck({ pkgDir = 'packages/api-client-ts', openapi = OPENAPI } = {}) {
  const output = `${pkgDir}/src/generated/schema.ts`;
  return {
    name: 'api-client-ts',
    inputs: [openapi],
    outputs: [`${pkgDir}/src/generated`],
    hint: 'openapi.json changed: run `node scripts/check-drift.mjs --fix` and commit the TS client',
    async generate(outDir, { root }) {
      const manifest = createRequire(join(root, pkgDir, 'package.json')).resolve(
        'openapi-typescript/package.json',
      );
      const cli = join(dirname(manifest), 'bin', 'cli.js');
      const target = join(outDir, output);
      mkdirSync(dirname(target), { recursive: true });
      await mustRun(
        'openapi-typescript',
        process.execPath,
        [cli, resolve(root, openapi), '--output', target],
        root,
      );
    },
  };
}

/**
 * swagger_parser + build_runner (json_serializable, retrofit) → lib/src/generated/ of
 * packages/api_client_dart. Runs in a standalone copy of the package in the temp directory
 * (pubspec without `resolution: workspace`, the workspace lockfile, offline), so the committed
 * package is never touched and the versions are the locked ones.
 */
export function apiClientDartCheck({
  pkgDir = 'packages/api_client_dart',
  openapi = OPENAPI,
  budget,
} = {}) {
  const generated = `${pkgDir}/lib/src/generated`;
  return {
    name: 'api-client-dart',
    full: true,
    inputs: [
      openapi,
      `${pkgDir}/swagger_parser.yaml`,
      `${pkgDir}/build.yaml`,
      `${pkgDir}/pubspec.yaml`,
      'pubspec.lock',
    ],
    outputs: [generated],
    budget,
    hint: 'openapi.json changed: run `node scripts/check-drift.mjs --full --fix` and commit the Dart client',
    async generate(outDir, { root }) {
      const work = join(outDir, '.work', 'api_client_dart');
      mkdirSync(work, { recursive: true });
      const pubspec = readFileSync(join(root, pkgDir, 'pubspec.yaml'), 'utf8');
      writeFileSync(
        join(work, 'pubspec.yaml'),
        pubspec.replace(/^resolution: workspace\r?\n/m, ''),
      );
      for (const file of ['swagger_parser.yaml', 'build.yaml']) {
        cpSync(join(root, pkgDir, file), join(work, file));
      }
      cpSync(join(root, 'pubspec.lock'), join(work, 'pubspec.lock'));

      const dart = (step, ...args) =>
        mustRun(step, process.execPath, [join(root, 'scripts', 'dart.mjs'), 'dart', ...args], work);
      await dart('pub get', 'pub', 'get', '--offline');
      await dart(
        'swagger_parser',
        'run',
        'swagger_parser',
        '--schema_path',
        resolve(root, openapi),
        '--output_directory',
        'lib/src/generated',
      );
      await dart('build_runner', 'run', 'build_runner', 'build', '--delete-conflicting-outputs');
      await dart('dart format', 'format', 'lib/src/generated');
      cpSync(join(work, 'lib', 'src', 'generated'), join(outDir, generated), { recursive: true });
    },
  };
}
