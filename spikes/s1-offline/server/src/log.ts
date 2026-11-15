// Redacting logger: callers pass flat records; only allow-listed keys with primitive values are
// written. Bodies, headers, names, phones and tokens never reach it (spec: money, abuse, privacy).
export type Logger = (line: Record<string, unknown>) => void;

const ALLOWED = new Set([
  'event',
  'tenantId',
  'commandId',
  'code',
  'count',
  'method',
  'route',
  'status',
  'ms',
]);

export function redacting(sink: Logger): Logger {
  return (line) => {
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(line)) {
      if (!ALLOWED.has(key)) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safe[key] = value;
      }
    }
    sink(safe);
  };
}

/** Production sink of the spike server: one JSON line on stdout. */
export const stdoutSink: Logger = (line) => {
  process.stdout.write(`${JSON.stringify(line)}\n`);
};
