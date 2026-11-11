// Pure readers for the answers of Tempo, Loki, Prometheus and GlitchTip, used by obs-smoke.ts
// (spec 0.2-09b criterion 10). Every reader accepts `unknown` and returns "not found" for
// anything it does not recognise, so a changed API makes the smoke check fail, not crash.

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const field = (value: unknown, key: string): unknown => (isObject(value) ? value[key] : undefined);

const HEX_TRACE = /^[0-9a-f]{32}$/i;

/** Tempo returns ids as hex or, in its protobuf JSON, as base64 of the 16 bytes. */
function traceIdHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (HEX_TRACE.test(value)) return value.toLowerCase();
  const hex = Buffer.from(value, 'base64').toString('hex');
  return hex.length === 32 ? hex : undefined;
}

const SERVER_KINDS = new Set<unknown>([2, 'SPAN_KIND_SERVER']);

/** True when a Tempo trace (v1 `batches` or v2 `trace.resourceSpans`) has the server span. */
export function hasServerSpan(body: unknown, traceId: string, name: string): boolean {
  const trace = isObject(field(body, 'trace')) ? field(body, 'trace') : body;
  const resources = [...list(field(trace, 'resourceSpans')), ...list(field(trace, 'batches'))];
  for (const resource of resources) {
    const scopes = [
      ...list(field(resource, 'scopeSpans')),
      ...list(field(resource, 'instrumentationLibrarySpans')),
    ];
    for (const scope of scopes) {
      for (const span of list(field(scope, 'spans'))) {
        if (
          field(span, 'name') === name &&
          SERVER_KINDS.has(field(span, 'kind')) &&
          traceIdHex(field(span, 'traceId')) === traceId.toLowerCase()
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/** The log lines of a Loki `query_range` answer that carry `trace_id` (label or metadata). */
export function lokiLines(body: unknown, traceId: string): string[] {
  if (field(body, 'status') !== 'success') return [];
  const lines: string[] = [];
  for (const stream of list(field(field(body, 'data'), 'result'))) {
    const labels = field(stream, 'stream');
    for (const entry of list(field(stream, 'values'))) {
      const [, line, metadata] = list(entry);
      const carried =
        field(labels, 'trace_id') === traceId ||
        field(metadata, 'trace_id') === traceId ||
        field(field(metadata, 'structuredMetadata'), 'trace_id') === traceId;
      if (carried && typeof line === 'string') lines.push(line);
    }
  }
  return lines;
}

/** The number of series in a successful Prometheus query answer. */
export function prometheusSeries(body: unknown): number {
  if (field(body, 'status') !== 'success') return 0;
  return list(field(field(body, 'data'), 'result')).length;
}

/** The id of the GlitchTip event (from the project's event list) tagged with `traceId`. */
export function glitchtipEventFor(events: unknown, traceId: string): string | undefined {
  for (const event of list(events)) {
    const tagged = list(field(event, 'tags')).some(
      (tag) => field(tag, 'key') === 'trace_id' && field(tag, 'value') === traceId,
    );
    const id = field(event, 'eventID') ?? field(event, 'id');
    if (tagged && typeof id === 'string') return id;
  }
  return undefined;
}

/** True when `marker` appears anywhere in the payload, as stored (serialised and searched). */
export function leaks(payload: unknown, marker: string): boolean {
  return JSON.stringify(payload ?? null).includes(marker);
}

/** A DSN for printing: the public key hidden, host and project kept. */
export function maskDsn(dsn: string): string {
  try {
    const url = new URL(dsn);
    if (!url.username) return '****';
    return `${url.protocol}//****@${url.host}${url.pathname}`;
  } catch {
    return '****';
  }
}
