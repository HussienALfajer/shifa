// Forwards pino lines to the OpenTelemetry log pipeline (→ Collector → Loki). Each line arrives
// already serialised: the redaction paths and serializers of platform/logging.ts have run. The
// OTLP record holds what stdout holds, except that an `err` keeps identifiers and stack frames
// only (no message), plus the trace context the line names.
import { logs, ROOT_CONTEXT, SeverityNumber, TraceFlags, trace } from '@opentelemetry/api';
import type { LogForwarder } from '../platform/logging.ts';
import { stackFrames } from './stack.ts';

const SCOPE = 'shifa-api';

/** pino numeric levels → OpenTelemetry severity numbers and texts. */
const SEVERITY: Record<number, [SeverityNumber, string]> = {
  10: [SeverityNumber.TRACE, 'TRACE'],
  20: [SeverityNumber.DEBUG, 'DEBUG'],
  30: [SeverityNumber.INFO, 'INFO'],
  40: [SeverityNumber.WARN, 'WARN'],
  50: [SeverityNumber.ERROR, 'ERROR'],
  60: [SeverityNumber.FATAL, 'FATAL'],
};
const DEFAULT_SEVERITY: [SeverityNumber, string] = [SeverityNumber.INFO, 'INFO'];

const HEX_TRACE = /^[0-9a-f]{32}$/;
const HEX_SPAN = /^[0-9a-f]{16}$/;

type AttributeValue = string | number | boolean;

function attributeOf(value: unknown): AttributeValue | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) return undefined;
  return JSON.stringify(value);
}

/** Fields of a describeError() record that hold identifiers, never values. */
const ERROR_FIELDS = ['type', 'sqlstate', 'constraint', 'table', 'column'] as const;

/**
 * The `err` field as it may leave the API (spec edge case: the message is replaced by the
 * error class and code before sending). stdout keeps describeError()'s message and stack for
 * local debugging; the exported record keeps identifiers and stack frames only.
 */
function exportedError(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value === undefined ? undefined : '?';
  const err = value as Record<string, unknown>;
  const kept: Record<string, string> = {};
  for (const field of ERROR_FIELDS) {
    if (typeof err[field] === 'string') kept[field] = err[field];
  }
  const type = kept['type'] ?? 'Error';
  if (typeof err['stack'] === 'string') {
    const message = typeof err['message'] === 'string' ? err['message'] : undefined;
    kept['stack'] = stackFrames(err['stack'], type, message);
  }
  return kept;
}

export function otlpLogForwarder(): LogForwarder {
  const logger = logs.getLogger(SCOPE);
  return {
    write(line: string) {
      let record: Record<string, unknown>;
      try {
        record = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return; // pino writes one JSON object per line; anything else is not ours to forward
      }
      const { level, time, msg, trace_id: traceId, span_id: spanId, ...fields } = record;
      const [severityNumber, severityText] = SEVERITY[Number(level)] ?? DEFAULT_SEVERITY;
      const attributes: Record<string, AttributeValue> = {};
      for (const [key, value] of Object.entries(fields)) {
        const attribute = attributeOf(key === 'err' ? exportedError(value) : value);
        if (attribute !== undefined) attributes[key] = attribute;
      }
      const correlated =
        typeof traceId === 'string' &&
        typeof spanId === 'string' &&
        HEX_TRACE.test(traceId) &&
        HEX_SPAN.test(spanId)
          ? trace.setSpanContext(ROOT_CONTEXT, {
              traceId,
              spanId,
              traceFlags: TraceFlags.SAMPLED,
              isRemote: false,
            })
          : ROOT_CONTEXT;
      logger.emit({
        severityNumber,
        severityText,
        body: typeof msg === 'string' ? msg : '',
        attributes,
        ...(typeof time === 'number' ? { timestamp: time } : {}),
        context: correlated,
      });
    },
  };
}
