// Pure policy for the Claude Code hooks. No I/O here, so every rule is unit-tested
// (scripts/test/claude-hooks.test.mjs). Each check returns null (allowed) or a reason string.

/** Converts an absolute or relative path to a forward-slash path relative to the repo root. */
export function toRepoPath(filePath, projectDir) {
  const norm = (p) => p.replaceAll('\\', '/').replace(/\/+$/, '');
  const file = norm(filePath);
  const root = norm(projectDir);
  if (file.toLowerCase().startsWith(`${root.toLowerCase()}/`)) return file.slice(root.length + 1);
  return file;
}

const SECRET_FILE = [
  /(^|\/)\.env(\.(?!example$)[^/]*)?$/, // .env, .env.local — but not .env.example
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)secrets\//,
  /(^|\/)(dumps|data-exports)\//,
  /\.(dump|sql\.gz|bak)$/i,
];

const GENERATED = [
  /(^|\/)generated\//,
  /\.generated\.[a-z]+$/,
  /^packages\/api-client-ts\//,
  /^packages\/api_client_dart\/lib\//,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)pubspec\.lock$/,
];

export function isSecretPath(repoPath) {
  return SECRET_FILE.some((re) => re.test(repoPath));
}

/**
 * Decides whether Claude may create or change a file.
 * @param {string} repoPath forward-slash path relative to the repo root
 * @param {{ tracked: boolean, lockedTests: string[] }} ctx tracked = file is already in git
 * @returns {string | null}
 */
export function checkEdit(repoPath, { tracked, lockedTests }) {
  if (isSecretPath(repoPath)) {
    return `${repoPath} may hold secrets or data dumps; Claude never writes these files (data-handling policy).`;
  }
  if (GENERATED.some((re) => re.test(repoPath))) {
    return `${repoPath} is generated; change its source and re-run the generator instead.`;
  }
  if (repoPath.startsWith('docs/research/archive/')) {
    return 'docs/research/archive/ is read-only evidence; cite it, do not edit it.';
  }
  if (tracked && /^docs\/adr\/\d{4}-.*\.md$/.test(repoPath)) {
    return `${repoPath} is an accepted ADR and is never edited; write a new ADR that supersedes it.`;
  }
  if (tracked && /(^|\/)migrations\/.+\.(sql|ts)$/.test(repoPath)) {
    return `${repoPath} is a committed migration; add a new migration instead (expand → migrate → contract).`;
  }
  if (lockedTests.includes(repoPath)) {
    return `${repoPath} is a locked test for the current slice; make the implementation pass it instead of changing it.`;
  }
  return null;
}

const SOURCE_DIRS = ['apps', 'packages', 'tooling', 'scripts', '.claude'];
const sourceTarget = String.raw`["']?(?:\./)?(?:${SOURCE_DIRS.map((d) => d.replace('.', '\\.')).join('|')})/`;

const BASH_RULES = [
  {
    re: new RegExp(String.raw`(^|[^0-9&>])>{1,2}\s*${sourceTarget}`),
    why: 'Shell redirection into a source folder bypasses the format and edit hooks; use the Edit or Write tool.',
  },
  {
    re: new RegExp(String.raw`\btee\b[^|;&]*\s${sourceTarget}`),
    why: '`tee` into a source folder bypasses the edit hooks; use the Edit or Write tool.',
  },
  {
    re: new RegExp(String.raw`\b(sed|perl)\b[^|;&]*\s-[a-zA-Z]*i[^|;&]*${sourceTarget}`),
    why: 'In-place shell edits of source files bypass the edit hooks; use the Edit tool.',
  },
  {
    re: new RegExp(String.raw`\b(Set-Content|Add-Content|Out-File)\b[^|;]*${sourceTarget}`, 'i'),
    why: 'PowerShell writes into a source folder bypass the edit hooks; use the Edit or Write tool.',
  },
  {
    re: /\b(cat|less|more|head|tail|type|bat|source|Get-Content|gc|xxd|od|strings|base64)\b[^|;&]*(^|[\s"'/\\])\.env(?!\.example)(\.[\w.-]+)?(\s|$|["'])/i,
    why: 'Reading .env files is denied; Claude never handles real credentials.',
  },
  {
    re: /\b(cat|less|more|head|tail|type|Get-Content|base64)\b[^|;&]*\.(pem|key|p12|pfx)\b/i,
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
    re: /(--dangerously-skip-permissions|bypassPermissions)/,
    why: 'Bypassing permissions is never allowed in this project.',
  },
];

/** @returns {string | null} reason the command is blocked */
export function checkBash(command) {
  for (const rule of BASH_RULES) {
    if (rule.re.test(command)) return rule.why;
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
