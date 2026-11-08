// Migration drift (registered as `migrations` in scripts/drift.config.mjs). Offline: drizzle-kit
// diffs the schema against the latest committed snapshot and never connects to a database.
//   1. folder rules: `YYYYMMDDHHMMSS_<snake_name>`, strictly increasing timestamps, each folder
//      has migration.sql + snapshot.json, and folders new on this branch sort after main's newest;
//   2. `drizzle-kit check` on the committed folder (snapshot chain and collisions; failure → log);
//   3. `drizzle-kit generate` into a temp copy: any new folder means the schema changed without one.
// Migrations are written with /db-migration, never regenerated, so the check is not fixable.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FOLDER = /^(\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*$/;
const REQUIRED = ['migration.sql', 'snapshot.json'];
const TIMEOUT_MS = 120_000;

/** Problems with the migration folders in `dir`, each naming the folder. */
export function folderProblems(dir, { mainFolders }) {
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const problems = [];
  let previous = null;
  for (const name of names) {
    const match = FOLDER.exec(name);
    if (!match) {
      problems.push(`${name}: folder name must be YYYYMMDDHHMMSS_<snake_name>`);
      continue;
    }
    for (const file of REQUIRED) {
      if (!existsSync(join(dir, name, file))) problems.push(`${name}: missing ${file}`);
    }
    if (previous && FOLDER.exec(previous)[1] === match[1]) {
      problems.push(`${name}: timestamp is not after ${previous}`);
    }
    previous = name;
  }
  if (mainFolders?.length) {
    const onMain = new Set(mainFolders);
    const newest = [...mainFolders].sort().at(-1);
    for (const name of names) {
      if (!onMain.has(name) && name < newest) {
        problems.push(
          `${name}: new on this branch but older than ${newest} on main; regenerate it`,
        );
      }
    }
  }
  return problems;
}

/** Folder names under `rel` on `main` (or `origin/main`); null when neither ref exists (CI). */
function gitMainFolders(root, rel) {
  for (const ref of ['main', 'origin/main']) {
    const res = spawnSync('git', ['ls-tree', '--name-only', ref, '--', `${rel}/`], {
      cwd: root,
      encoding: 'utf8',
    });
    if (res.status === 0) {
      return res.stdout
        .split('\n')
        .filter(Boolean)
        .map((p) => p.slice(rel.length + 1));
    }
  }
  return null;
}

function drizzleKit(dbAbs, args) {
  const bin = join(dbAbs, 'node_modules', 'drizzle-kit', 'bin.cjs');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: dbAbs,
      // No stdin: an interactive prompt (rename detection) fails instead of hanging.
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

export function migrationsCheck({ dbDir = 'packages/db', mainFolders } = {}) {
  const rel = `${dbDir}/migrations`;
  return {
    name: 'migrations',
    inputs: [`${dbDir}/src/schema`, `${dbDir}/drizzle.config.ts`, rel],
    outputs: [rel],
    fixable: false,
    hint: 'schema changed without a migration: run /db-migration (migrations are never --fix-ed)',
    async generate(outDir, { root }) {
      const dbAbs = join(root, dbDir);
      const committed = join(dbAbs, 'migrations');
      const main = mainFolders === undefined ? gitMainFolders(root, rel) : mainFolders;
      const problems = folderProblems(committed, { mainFolders: main });
      if (problems.length) return { problems };

      // A failed check cannot be told apart from a crashed tool, so both go to the log (exit 2).
      const checked = await drizzleKit(dbAbs, ['check', '--config', 'drizzle.config.ts']);
      if (checked.code !== 0) throw new Error(`drizzle-kit check failed\n${checked.output}`);

      // Same config, `out` pointed at a temp copy of the committed folders.
      const target = join(outDir, rel);
      cpSync(committed, target, { recursive: true });
      const config = join(outDir, 'drizzle.drift.config.ts');
      const base = join(dbAbs, 'drizzle.config.ts').replaceAll('\\', '/');
      writeFileSync(
        config,
        `import base from ${JSON.stringify(base)};\n` +
          `export default { ...base, out: ${JSON.stringify(target.replaceAll('\\', '/'))} };\n`,
      );
      const generated = await drizzleKit(dbAbs, ['generate', '--config', config]);
      // A rename or replace needs interactive decisions; without stdin drizzle-kit stops with
      // `missing_hints`. That is still a schema change without a migration, not a crash.
      if (generated.code !== 0 && /missing_hints|unresolved decisions/.test(generated.output)) {
        return {
          problems: [
            'schema changed (rename or replace) without a migration: run /db-migration and answer its prompts',
          ],
        };
      }
      if (generated.code !== 0) {
        throw new Error(
          `drizzle-kit generate exited ${generated.code}${generated.signal ? ` (${generated.signal})` : ''}\n${generated.output}`,
        );
      }
      return undefined;
    },
  };
}
