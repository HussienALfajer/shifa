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

const SECRET_FILE = [
  /(^|\/)\.env(\.(?!example$)[^/]*)?$/i, // .env, .env.local — but not .env.example
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)secrets\//i,
  /(^|\/)(dumps|data-exports)\//i,
  /\.(dump|sql\.gz|bak)$/i,
];

const GENERATED = [
  /(^|\/)generated\//i,
  /\.generated\.[a-z]+$/i,
  /^packages\/api-client-ts\//i,
  /^packages\/api_client_dart\/lib\//i,
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)pubspec\.lock$/i,
];

export function isSecretPath(repoPath) {
  return SECRET_FILE.some((re) => re.test(repoPath));
}

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
  if (isSecretPath(repoPath)) {
    return `${repoPath} may hold secrets or data dumps; Claude never writes these files (data-handling policy).`;
  }
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

const READERS = String.raw`cat|less|more|head|tail|type|bat|source|Get-Content|gc|xxd|od|strings|base64|grep|rg|awk|sed|sort|cp|copy|Copy-Item|Select-String|sls|findstr`;

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
  {
    re: new RegExp(
      String.raw`\b(${READERS})\b[^|;&]*(?:^|[\s"'/\\])\.env(?!\.example)(\.[\w.-]+)?(?:\s|$|["'])`,
      'i',
    ),
    why: 'Reading .env files is denied; Claude never handles real credentials.',
  },
  {
    re: new RegExp(String.raw`\b(${READERS})\b[^|;&]*\.(pem|key|p12|pfx)\b`, 'i'),
    why: 'Reading private keys is denied.',
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
    why: 'Bypassing permissions is never allowed in this project.',
  },
];

/** @returns {string | null} reason the command is blocked */
export function checkBash(command) {
  const cmd = stripPayload(command);
  for (const rule of BASH_RULES) {
    if (rule.re.test(cmd)) return rule.why;
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
