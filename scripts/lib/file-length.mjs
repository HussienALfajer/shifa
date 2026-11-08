// File-length limit for hand-written Dart, matching ESLint `max-lines` for TypeScript
// (400 lines, blank lines and comments not counted). Generated files are exempt.

export const MAX_LINES = 400;

const GENERATED_DART = [
  /\.g\.dart$/,
  /\.freezed\.dart$/,
  /\.mocks\.dart$/,
  /(^|\/)generated\//,
  /^packages\/api_client_dart\//,
];

/** @param {string} path repository-relative, forward slashes */
export function isGeneratedDart(path) {
  return GENERATED_DART.some((re) => re.test(path));
}

/**
 * Counts lines that hold code. A line that only holds a comment (`//`, `///` or part of a
 * block comment) or whitespace is skipped. Comment markers inside strings are not special-cased:
 * the count is a size budget, not a parser.
 * @param {string} source
 */
export function countCodeLines(source) {
  let inBlock = false;
  let count = 0;
  for (const raw of source.split(/\r?\n/)) {
    let line = raw.trim();
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      inBlock = false;
      line = line.slice(end + 2).trim();
    }
    while (line.startsWith('/*')) {
      const end = line.indexOf('*/', 2);
      if (end === -1) {
        inBlock = true;
        line = '';
        break;
      }
      line = line.slice(end + 2).trim();
    }
    if (line === '' || line.startsWith('//')) continue;
    count += 1;
    // A block comment opened after code and not closed on this line continues below.
    const open = line.lastIndexOf('/*');
    if (open > 0 && line.indexOf('*/', open + 2) === -1) inBlock = true;
  }
  return count;
}

/**
 * @param {{ path: string, source: string }[]} files
 * @returns {{ path: string, lines: number }[]} hand-written files over the limit
 */
export function tooLong(files, max = MAX_LINES) {
  return files
    .filter((f) => !isGeneratedDart(f.path))
    .map((f) => ({ path: f.path, lines: countCodeLines(f.source) }))
    .filter((f) => f.lines > max);
}
