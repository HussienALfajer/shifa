// Pure core of `pnpm env:check`: turns probe results into one row per item. Probes are injected
// so tests never spawn tools. Privacy: details carry versions, tool names and repository-relative
// paths only; this module reads no environment variable, no .env file and never prints the
// repository root, the home directory or absolute tool paths.

/** @typedef {'ok' | 'warn' | 'fail'} Status */
/** @typedef {{ item: string, status: Status, detail: string }} Row */
/**
 * @typedef {{
 *   nodeVersion: () => string,
 *   pnpmVersion: () => string | null,
 *   packageManager: () => string | null,
 *   fvmFlutterVersion: () => string | null,
 *   pinnedFlutter: () => string | null,
 *   dockerReachable: () => string | null,
 *   gitConfig: (key: string) => string | null,
 *   lsFilesEol: () => string | null,
 *   which: (cmd: string) => boolean,
 * }} Probes
 */

const GUIDE = 'docs/process/wsl2-setup.md';
const APT = 'sudo apt install bubblewrap socat';
const MAX_PATHS = 10;

/**
 * @param {Probes} probes
 * @param {{ platform: NodeJS.Platform, repoRoot: string }} context
 * @returns {{ rows: Row[], exitCode: 0 | 1 }}
 */
export function runEnvChecks(probes, { platform, repoRoot }) {
  /** @type {Array<[string, () => Omit<Row, 'item'>]>} */
  const checks = [
    ['node', () => checkNode(probes.nodeVersion())],
    ['pnpm', () => checkPnpm(probes.pnpmVersion(), probes.packageManager())],
    ['flutter', () => checkFlutter(probes.fvmFlutterVersion(), probes.pinnedFlutter())],
    ['docker', () => checkDocker(probes.dockerReachable())],
    ['git autocrlf', () => checkAutocrlf(probes.gitConfig('core.autocrlf'), platform)],
    ['line endings', () => checkLineEndings(probes.lsFilesEol())],
  ];
  if (platform === 'linux') {
    checks.push(['repo location', () => checkLocation(repoRoot)]);
    for (const tool of ['bwrap', 'socat']) {
      checks.push([tool, () => checkTool(tool, probes.which(tool))]);
    }
  } else if (platform === 'win32') {
    checks.push(['sandbox', () => warn(`sandbox unavailable on Windows; use WSL2 (${GUIDE})`)]);
  } else {
    checks.push(['sandbox', () => warn(`sandbox check covers WSL2 only (${GUIDE})`)]);
  }

  const rows = checks.map(([item, check]) => {
    try {
      return { item, ...check() };
    } catch {
      // The error text may hold absolute paths or environment details, so it is not printed.
      return { item, ...fail('check could not run') };
    }
  });
  return { rows, exitCode: rows.some((r) => r.status === 'fail') ? 1 : 0 };
}

/** @param {Row[]} rows @returns {string} one aligned line per row */
export function formatRows(rows) {
  const itemWidth = Math.max(...rows.map((r) => r.item.length));
  return rows
    .map((r) => `${r.item.padEnd(itemWidth)}  ${r.status.padEnd(4)}  ${r.detail}`)
    .join('\n')
    .concat('\n');
}

const ok = (detail) => ({ status: /** @type {Status} */ ('ok'), detail });
const warn = (detail) => ({ status: /** @type {Status} */ ('warn'), detail });
const fail = (detail) => ({ status: /** @type {Status} */ ('fail'), detail });

function checkNode(version) {
  const major = Number(/^v?(\d+)\./.exec(version ?? '')?.[1]);
  return major === 24
    ? ok(version)
    : fail(`Node ${version ?? '(unknown)'}; Node 24 is required (.nvmrc)`);
}

function checkPnpm(actual, packageManager) {
  // `corepack use` appends a hash (`pnpm@12.4.1+sha512.…`); only the version is compared.
  const expected = /^pnpm@([^+]+)/.exec(packageManager ?? '')?.[1];
  if (!expected) return fail('package.json has no pnpm packageManager field');
  if (!actual) return fail(`pnpm not found; enable Corepack to get pnpm ${expected}`);
  return actual === expected
    ? ok(actual)
    : fail(`pnpm ${actual}, but packageManager pins ${expected}; run \`corepack enable\``);
}

function checkFlutter(actual, pinned) {
  if (!pinned) return fail('.fvmrc has no flutter version');
  if (!actual) {
    return fail(`no FVM Flutter SDK; run \`fvm install\` in the repository root (${pinned})`);
  }
  return actual === pinned
    ? ok(actual)
    : fail(`Flutter ${actual}, but .fvmrc pins ${pinned}; run \`fvm install\` and \`fvm use\``);
}

function checkDocker(version) {
  return version
    ? ok(`daemon ${version}`)
    : fail(
        'Docker daemon not reachable; start Docker Desktop and, in WSL2, enable ' +
          'Docker Desktop → Settings → Resources → WSL integration for this distro',
      );
}

/** Values git reads as true for a boolean setting. */
const GIT_TRUE = new Set(['true', 'yes', 'on', '1']);

function checkAutocrlf(value, platform) {
  const v = value?.trim().toLowerCase();
  if (!GIT_TRUE.has(v ?? '')) return ok(`core.autocrlf=${v || '(unset)'}`);
  const fix = 'run `git config --global core.autocrlf false`';
  // Git for Windows sets true system-wide; `.gitattributes` (`eol=lf`) overrides it in this
  // repository, so on the Windows fallback it is a warning, not a blocker.
  return platform === 'win32'
    ? warn(`core.autocrlf=${v} (overridden by .gitattributes here); ${fix}`)
    : fail(`core.autocrlf=${v}; ${fix}`);
}

function checkLineEndings(eolListing) {
  if (eolListing === null) return fail('`git ls-files --eol` could not run');
  const crlf = eolListing
    .split('\n')
    .filter((line) => /^i\/(crlf|mixed)\s/.test(line))
    .map((line) => line.slice(line.indexOf('\t') + 1).trim());
  if (crlf.length === 0) return ok('no CRLF in tracked files');
  const shown = crlf.slice(0, MAX_PATHS).join(', ');
  const more = crlf.length > MAX_PATHS ? `, and ${crlf.length - MAX_PATHS} more` : '';
  return fail(
    `${crlf.length} tracked file(s) committed with CRLF or mixed endings:${shown}${more}; ` +
      'run `git add --renormalize .`',
  );
}

function checkLocation(repoRoot) {
  return repoRoot.startsWith('/mnt/')
    ? fail(
        'repository is on a Windows drive (/mnt/): slow I/O, broken file watching and ' +
          'permissions; clone it into ~/src/shifa instead',
      )
    : ok('on the Linux filesystem');
}

function checkTool(tool, found) {
  return found ? ok(`${tool} on PATH`) : fail(`${tool} not on PATH; run \`${APT}\``);
}
