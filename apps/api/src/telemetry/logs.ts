// Forwards pino lines to the OpenTelemetry log pipeline (→ Collector → Loki). Each line arrives
// already serialised: the redaction paths and serializers of platform/logging.ts have run, so
// the OTLP record holds exactly what stdout holds, plus the trace context it names.
import { logs, ROOT_CONTEXT, SeverityNumber, TraceFlags, trace } from '@opentelemetry/api';
import type { LogForwarder } from '../platform/logging.ts';

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
        const attribute = attributeOf(value);
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
