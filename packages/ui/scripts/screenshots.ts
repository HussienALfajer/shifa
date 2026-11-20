// Screenshot comparison of every story (spec 0.4 criterion 9, slice 0.4-03).
//   pnpm --filter @shifa/ui screenshots             compare with screenshots/baselines/
//   pnpm --filter @shifa/ui screenshots --update    write the baselines (commit them)
// Needs the built Storybook (`storybook:build`) and Docker. The browser runs inside the pinned
// Playwright image (scripts/screenshot-image.ts) as `playwright run-server`; Playwright Test on
// this machine connects to it, and the image reaches the Storybook served here through the
// connection, so the pixels come from the image on every machine. Without Docker (the
// sandboxed WSL2 session, OD-24) run the `ui-baselines` workflow instead.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAYWRIGHT_IMAGE, PLAYWRIGHT_VERSION } from './screenshot-image.ts';

const pkg = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const update = args.includes('--update');
if (args.some((a) => a !== '--update')) {
  process.stderr.write(`screenshots: unknown argument (use --update or none): ${args.join(' ')}\n`);
  process.exit(2);
}

function fail(message: string): never {
  process.stderr.write(`screenshots: ${message}\n`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
if (manifest.devDependencies['playwright'] !== PLAYWRIGHT_VERSION) {
  fail(`the image is Playwright ${PLAYWRIGHT_VERSION} but packages/ui pins another playwright`);
}
if (!existsSync(join(pkg, 'storybook-static', 'index.json'))) {
  fail('no built Storybook; run `pnpm --filter @shifa/ui storybook:build` first');
}

const docker = (dockerArgs: string[]) => spawnSync('docker', dockerArgs, { encoding: 'utf8' });
if (docker(['version', '--format', '{{.Server.Version}}']).status !== 0) {
  fail('Docker is not running; it holds the pinned browser (or run the ui-baselines workflow)');
}

const started = docker([
  'run',
  '--detach',
  '--rm',
  '--init',
  '--publish',
  '127.0.0.1::3000',
  PLAYWRIGHT_IMAGE,
  '/bin/sh',
  '-c',
  `cd /tmp && npx -y playwright@${PLAYWRIGHT_VERSION} run-server --port 3000 --host 0.0.0.0`,
]);
if (started.status !== 0) fail(`could not start the browser image:\n${started.stderr}`);
const container = started.stdout.trim();

async function main(): Promise<number> {
  const mapped = docker(['port', container, '3000/tcp']).stdout.trim().split('\n')[0] ?? '';
  const port = /:(\d+)$/.exec(mapped)?.[1];
  if (port === undefined) fail(`no published port for the browser (${mapped})`);
  // The server answers any HTTP request once it listens; `npx` may first download Playwright.
  const deadline = Date.now() + 180_000;
  for (;;) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      break;
    } catch {
      if (Date.now() > deadline) fail('the browser server did not start within 3 minutes');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const run = spawnSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'screenshots/playwright.config.ts',
      ...(update ? ['--update-snapshots=all'] : []),
    ],
    {
      cwd: pkg,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, SHIFA_PW_WS: `ws://127.0.0.1:${port}/` },
    },
  );
  return run.status ?? 1;
}

const status = await main().finally(() => {
  docker(['stop', '--time', '2', container]);
});
process.exit(status);
