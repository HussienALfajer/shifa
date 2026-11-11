// Error reporting to GlitchTip through the Sentry protocol (PLT-52 for error events). Built on
// @sentry/core alone: no @sentry/node, so the SDK installs no OpenTelemetry setup, no
// instrumentation and no integration of its own (0.2-09b1's tracer provider stays the only one).
// Off unless SENTRY_DSN is set (bootstrap.ts). Every event is rebuilt from an allowlist in
// beforeSend: exception class and code, stack frames, and the tags listed below; nothing else.
import { trace } from '@opentelemetry/api';
import {
  type BaseTransportOptions,
  createStackParser,
  createTransport,
  type ErrorEvent,
  type EventHint,
  flush,
  getClient,
  getCurrentScope,
  initAndBind,
  isInitialized,
  type StackFrame,
  type Transport,
  withScope,
} from '@sentry/core';
import { nodeStackLineParser, ServerRuntimeClient } from '@sentry/core/server';

export interface ErrorReportingOptions {
  dsn: string;
  release: string;
  environment: string;
  /** Tests replace the network with a stub; production sends with fetch. */
  transport?: (options: BaseTransportOptions) => Transport;
}

/** What is known about a failure when it is reported; the only description that is sent. */
export interface ErrorContext {
  /** Route template (`/patients/:id`), never the URL. */
  route?: string;
  status?: number;
  requestId?: string;
  /** describeError() type: the error class, or `DatabaseError`. */
  type: string;
  /** SQLSTATE of a database error. */
  code?: string;
}

/** The sending request gives up after this long; the event is then dropped. */
const SEND_TIMEOUT_MS = 10_000;

const ERROR_TYPE = /^[A-Za-z0-9_.$-]{1,64}$/;
const SQLSTATE = /^[0-9A-Z]{5}$/;
const HEX_TRACE = /^[0-9a-f]{32}$/;
const HEX_SPAN = /^[0-9a-f]{16}$/;
/** Tag values: printable ASCII without spaces (route templates, numbers, ids). */
const TAG_VALUE = /^[\x21-\x7e]{1,200}$/;
const TAGS = ['route', 'status', 'request_id', 'trace_id'] as const;
const MAX_FRAME_TEXT = 512;

/** Where reportError() leaves the description for beforeSend, inside the event hint. */
const DESCRIPTION = 'shifa.error';

interface Description {
  type: string;
  code?: string;
}

/** Sends envelopes with fetch (undici: not seen by the http instrumentation, so no spans). */
export function fetchTransport(options: BaseTransportOptions): Transport {
  return createTransport(options, async (request) => {
    const res = await fetch(options.url, {
      method: 'POST',
      body: request.body,
      ...(options.headers ? { headers: options.headers } : {}),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    await res.body?.cancel();
    return {
      statusCode: res.status,
      headers: {
        'x-sentry-rate-limits': res.headers.get('x-sentry-rate-limits'),
        'retry-after': res.headers.get('retry-after'),
      },
    };
  });
}

function descriptionOf(hint: EventHint): Description {
  const data = (hint.data as Record<string, unknown> | undefined)?.[DESCRIPTION] as
    | Partial<Record<keyof Description, unknown>>
    | undefined;
  const type = typeof data?.type === 'string' && ERROR_TYPE.test(data.type) ? data.type : 'Error';
  const code = typeof data?.code === 'string' && SQLSTATE.test(data.code) ? data.code : undefined;
  return code === undefined ? { type } : { type, code };
}

const text = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value.slice(0, MAX_FRAME_TEXT) : undefined;
const integer = (value: unknown) => (Number.isInteger(value) ? (value as number) : undefined);

/** File, function, line and column; never source text (`context_line`) or `vars`. */
function frameOf(frame: StackFrame): StackFrame {
  const kept: StackFrame = {};
  const filename = text(frame.filename);
  const fn = text(frame.function);
  const lineno = integer(frame.lineno);
  const colno = integer(frame.colno);
  if (filename !== undefined) kept.filename = filename;
  if (fn !== undefined) kept.function = fn;
  if (lineno !== undefined) kept.lineno = lineno;
  if (colno !== undefined) kept.colno = colno;
  return kept;
}

/**
 * beforeSend: the event as it may leave the API. The exception's message is replaced by its
 * class and code (spec edge case: messages can quote user input); request, user, extra,
 * breadcrumbs, modules, server name and every context but the trace ids are dropped.
 */
export function scrubErrorEvent(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  const source = event.exception?.values?.at(-1);
  if (source === undefined) return null;
  const { type, code } = descriptionOf(hint);
  const frames = (source.stacktrace?.frames ?? []).map(frameOf);

  const tags: Record<string, string> = {};
  for (const key of TAGS) {
    const value = event.tags?.[key];
    if (typeof value === 'string' && TAG_VALUE.test(value)) tags[key] = value;
  }
  if (event.release !== undefined) tags['release'] = event.release;
  if (event.environment !== undefined) tags['environment'] = event.environment;

  const context = event.contexts?.trace;
  const traceId = tags['trace_id'] ?? context?.trace_id;
  const spanId = context?.span_id;
  // Opaque hex ids only; the trace id is the OpenTelemetry one when a span was active.
  const traced =
    typeof traceId === 'string' &&
    HEX_TRACE.test(traceId) &&
    typeof spanId === 'string' &&
    HEX_SPAN.test(spanId)
      ? { trace_id: traceId, span_id: spanId }
      : undefined;

  return {
    type: undefined,
    ...(event.event_id === undefined ? {} : { event_id: event.event_id }),
    ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }),
    platform: 'node',
    level: 'error',
    ...(event.release === undefined ? {} : { release: event.release }),
    ...(event.environment === undefined ? {} : { environment: event.environment }),
    tags,
    exception: {
      values: [
        {
          type,
          value: code === undefined ? type : `${type} ${code}`,
          ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
        },
      ],
    },
    ...(traced ? { contexts: { trace: traced } } : {}),
  };
}

export function startErrorReporting(options: ErrorReportingOptions): void {
  initAndBind(ServerRuntimeClient, {
    dsn: options.dsn,
    release: options.release,
    environment: options.environment,
    transport: options.transport ?? fetchTransport,
    stackParser: createStackParser(nodeStackLineParser()),
    // No integrations at all: no request data, local variables, console, http breadcrumbs or
    // global handlers (main.ts reports uncaught errors itself).
    integrations: [],
    // Errors only: no tracing, no span streaming.
    traceLifecycle: 'static',
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    sendClientReports: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: scrubErrorEvent,
    platform: 'node',
    runtime: { name: 'node' },
  });
}

/** Sends one event for `exception` with the context's tags; a no-op unless initialised. */
export function reportError(exception: unknown, context: ErrorContext): void {
  if (!isInitialized()) return;
  withScope((scope) => {
    const span = trace.getActiveSpan()?.spanContext();
    const traced = span && trace.isSpanContextValid(span) ? span : undefined;
    scope.setTags({
      ...(context.route === undefined ? {} : { route: context.route }),
      ...(context.status === undefined ? {} : { status: String(context.status) }),
      ...(context.requestId === undefined ? {} : { request_id: context.requestId }),
      ...(traced ? { trace_id: traced.traceId } : {}),
    });
    if (traced) {
      scope.setPropagationContext({
        traceId: traced.traceId,
        parentSpanId: traced.spanId,
        sampleRand: Math.random(),
      });
    }
    const description: Description =
      context.code === undefined
        ? { type: context.type }
        : { type: context.type, code: context.code };
    scope.captureException(exception, { data: { [DESCRIPTION]: description } });
  });
}

/** Waits up to `timeoutMs` for queued events; resolves false when off or timed out. */
export function flushErrors(timeoutMs: number): Promise<boolean> {
  return flush(timeoutMs);
}

/** Closes and unbinds the client (tests; the process otherwise exits with it). */
export async function stopErrorReporting(): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.close(2000);
  getCurrentScope().setClient(undefined);
}
