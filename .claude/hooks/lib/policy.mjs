// Pure policy for the Claude Code hooks. No I/O here, so every rule is unit-tested
// (scripts/test/claude-hooks.test.mjs). Each check returns null (allowed) or a reason string.
// The guards are a safety net for a well-meaning agent, not a sandbox against an attacker:
// they catch the common ways to slip past the edit hooks, and CI checks the rest.

import { posix } from 'node:path';

/**
 * Converts an absolute or relative path to a normalised forward-slash path relative to the
 * repo root (`..` resolved; root compared case-insensitively for Windows).
 */
export function toRepoPath(filePath, projectDir) {
  const norm = (p) => posix.normalize(p.trim().replaceAll('\\', '/')).replace(/\/+$/, '');
  const file = norm(filePath);
  const root = norm(projectDir);
  const rel = file.toLowerCase().startsWith(`${root.toLowerCase()}/`)
    ? file.slice(root.length + 1)
    : file;
  return rel.replace(/^\.\//, '');
}

// Secret files (.env, keys, secrets/, dumps) are not guarded: the owner allows Claude to read
// and edit them (ADR-0028). `.gitignore` and the CI secret scan still keep them out of git.

// The API clients keep their generated code under src/generated/ and lib/src/generated/
// (covered by the first rule); their package files, client.ts and tests are hand-written.
const GENERATED = [
  /(^|\/)generated\//i,
  /\.generated\.[a-z]+$/i,
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)pubspec\.lock$/i,
  /\.g\.dart$/i,
  /\.freezed\.dart$/i,
  /\.mocks\.dart$/i,
  // drizzle-kit output: per-migration snapshots (1.0 layout) and the pre-1.0 meta/ journal.
  /(^|\/)migrations\/[^/]+\/snapshot\.json$/i,
  /(^|\/)migrations\/meta\/[^/]+\.json$/i,
];

/** True when an Edit only rewrites the ADR's `Status:` line (e.g. "Superseded by ADR-0030"). */
export function isStatusLineEdit(oldString, newString) {
  const statusOnly = (s) =>
    typeof s === 'string' &&
    s.trim() !== '' &&
    s.trim().split('\n').length === 1 &&
    /^Status:/.test(s.trim());
  return statusOnly(oldString) && statusOnly(newString);
}

/**
 * Decides whether Claude may create or change a file.
 * @param {string} repoPath normalised path relative to the repo root
 * @param {{
 *   onMain: boolean,            // the file exists on main (merged work is protected, branch work is not)
 *   acceptedOnMain?: boolean,   // for ADRs: the copy on main says "Status: Accepted"
 *   statusLineOnly?: boolean,   // the edit only changes an ADR's Status line
 *   lockedTests: string[],
 * }} ctx
 * @returns {string | null}
 */
export function checkEdit(
  repoPath,
  { onMain, acceptedOnMain = false, statusLineOnly = false, lockedTests },
) {
  if (GENERATED.some((re) => re.test(repoPath))) {
    return `${repoPath} is generated; change its source and re-run the generator instead.`;
  }
  if (/^docs\/research\/archive\//i.test(repoPath)) {
    return 'docs/research/archive/ is read-only evidence; cite it, do not edit it.';
  }
  if (onMain && acceptedOnMain && /^docs\/adr\/\d{4}-.*\.md$/i.test(repoPath) && !statusLineOnly) {
    return `${repoPath} is an accepted ADR; only its Status line may change (e.g. "Superseded by ADR-NNNN"). Write a new ADR for the change.`;
  }
  if (onMain && /(^|\/)migrations\/.+\.(sql|ts)$/i.test(repoPath)) {
    return `${repoPath} is a merged migration; add a new migration instead (expand → migrate → contract).`;
  }
  if (lockedTests.some((t) => t.toLowerCase() === repoPath.toLowerCase())) {
    return `${repoPath} is a locked test for the current slice; make the implementation pass it, or ask the owner if the test is wrong.`;
  }
  return null;
}

/**
 * Removes text that is data, not command: heredoc bodies and the values of message, body and
 * title flags. Keeps the heredoc's first line, so `cat <<EOF > packages/x` is still checked.
 */
export function stripPayload(command) {
  let out = command;
  out = out.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, '<<$2$3');
  out = out.replace(
    /(\s(?:-m|-b|-t|--message|--body|--title|--notes|-Message|-Body))(\s+|=)("(?:[^"\\]|\\.)*"|'[^']*')/g,
    '$1$2""',
  );
  return out;
}

const SOURCE_DIRS = ['apps', 'packages', 'tooling', 'scripts', '.claude'];
// A path into a source folder: relative (`apps/`, `./apps\`) or absolute
// (`D:\shifa\apps`, `/d/shifa/apps`, `$CLAUDE_PROJECT_DIR/apps`), with / or \ separators.
const DIRS = SOURCE_DIRS.map((d) => d.replace('.', '\\.')).join('|');
// Optional prefix ending in a separator, then the folder name. `docs/myapps/` does not match,
// because the prefix must end exactly before the folder name.
const PATH_INTO_SRC = String.raw`["']?(?:[^\s"'|;&<>]*?[\\/])?(?:${DIRS})[\\/]`;
const SRC = String.raw`(?:^|[\s"'=(])${PATH_INTO_SRC}`;
const SRC_AFTER_OP = String.raw`\s*${PATH_INTO_SRC}`;

const BASH_RULES = [
  {
    re: new RegExp(String.raw`(?:^|[^0-9&>])>{1,2}${SRC_AFTER_OP}`),
    why: 'Shell redirection into a source folder bypasses the format and edit hooks; use the Edit or Write tool.',
  },
  {
    re: new RegExp(String.raw`\btee\b[^|;&]*${SRC}`),
    why: '`tee` into a source folder bypasses the edit hooks; use the Edit or Write tool.',
  },
  {
    re: new RegExp(String.raw`\b(sed|perl)\b[^|;&]*\s-[a-zA-Z]*i[^|;&]*${SRC}`),
    why: 'In-place shell edits of source files bypass the edit hooks; use the Edit tool.',
  },
  {
    re: new RegExp(
      String.raw`(?:^|[\s;|(])(Set-Content|Add-Content|Out-File|sc|ac)\b[^|;]*${SRC}`,
      'i',
    ),
    why: 'PowerShell writes into a source folder bypass the edit hooks; use the Edit or Write tool.',
  },
  { re: /\s--no-verify\b/, why: 'Skipping git hooks (--no-verify) is not allowed.' },
  {
    re: /\bgit\s+push\b[^|;&]*(\s(-f|--force|--force-with-lease)\b|\s\+)/,
    why: 'Force-pushing is not allowed.',
  },
  {
    re: /\bgit\s+push\b[^|;&]*\s(\S+:)?(refs\/heads\/)?main(\s|$)/,
    why: '`main` changes only through a reviewed pull request; push the slice branch instead.',
  },
  {
    re: /(--dangerously-skip-permissions|--permission-mode[\s=]+bypassPermissions)/,
    why: 'Claude never starts a session that skips permissions; the owner chooses the permission mode (ADR-0027).',
  },
  // ADR-0041 (OD-60): setup prompts in node_modules and on the web ask agents to fetch skills
  // and packages at run time, outside the lockfile and the 24-hour release age.
  {
    test: (cmd) => commandSegments(cmd).some(fetchesAndRuns),
    why: 'Packages are not fetched and run at run time (npx -y, npx <pkg>@<version>, npm exec, pnpm/yarn dlx, bunx); add an exact pin with pnpm, and write agent skills in this repository (ADR-0041).',
  },
  {
    test: (cmd) => commandSegments(cmd).some(installsOutsidePnpm),
    why: 'Packages are installed with pnpm only (lockfile, exact pins, 24-hour release age); never npm, yarn or bun (ADR-0041).',
  },
];

/** Each simple command of a shell line: its program (no path, quotes or .cmd/.exe) and words. */
function commandSegments(cmd) {
  // A quoted string with spaces or separators is an argument (a grep pattern, a message), never
  // a command; a short quoted word ("npm", "skills@latest") stays, unquoted below.
  const masked = cmd.replace(/"[^"]*[\s;&|`(][^"]*"|'[^']*[\s;&|`(][^']*'/g, 'Q');
  return masked.split(/[;&|\n]+|\$\(|`|\(/).map((segment) => {
    const words = segment
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/^["']+|["']+$/g, ''));
    let i = 0;
    const wrappers = new Set(['sudo', 'command', 'exec', 'env', 'time', 'nice']);
    while (i < words.length && (/^\w+=/.test(words[i]) || wrappers.has(words[i]))) i += 1;
    const program = (words[i] ?? '')
      .split(/[\\/]/)
      .pop()
      .replace(/\.(cmd|exe|ps1)$/i, '')
      .toLowerCase();
    return { program, args: words.slice(i + 1) };
  });
}

const NPM_INSTALL = new Set([
  'i',
  'in',
  'ins',
  'inst',
  'insta',
  'instal',
  'install',
  'isnt',
  'isntall',
  'add',
  'ci',
]);

function installsOutsidePnpm({ program, args }) {
  if (program === 'npm') return args.some((a) => NPM_INSTALL.has(a));
  if (program === 'yarn')
    return args.length === 0 || args.some((a) => ['add', 'install'].includes(a));
  if (program === 'bun') return args.some((a) => ['add', 'install', 'i'].includes(a));
  return false;
}

function fetchesAndRuns({ program, args }) {
  if (program === 'bunx') return true;
  if (program === 'npm') return args.some((a) => ['exec', 'x'].includes(a));
  if (program === 'pnpm' || program === 'yarn' || program === 'bun') {
    return args.includes('dlx') || (program === 'bun' && args.includes('x'));
  }
  if (program !== 'npx') return false;
  // `npx <local bin>` runs what the lockfile installed. npx's own options come before the
  // command; `-y`, `--package` or a versioned or `skills` command fetch from the registry.
  for (const a of args) {
    if (a.startsWith('-')) {
      if (/^(-y|--yes|-p|--package(=.*)?)$/.test(a)) return true;
      continue;
    }
    return /^skills(@.*)?$/.test(a) || /^(@[\w.-]+\/)?[\w.-]+@[^\s/]*$/.test(a);
  }
  return false;
}

/** @returns {string | null} reason the command is blocked */
export function checkBash(command) {
  const cmd = stripPayload(command);
  for (const rule of BASH_RULES) {
    if (rule.re ? rule.re.test(cmd) : rule.test(cmd)) return rule.why;
  }
  return null;
}

/** Changed paths (from `git status --porcelain`) that are code, not docs. */
export function codeChanges(porcelain) {
  return porcelain
    .split('\n')
    .filter(Boolean)
    .map((line) =>
      line
        .slice(3)
        .replace(/^.* -> /, '')
        .replace(/^"|"$/g, ''),
    )
    .filter((p) => !p.startsWith('docs/') && !p.endsWith('.md'));
}
