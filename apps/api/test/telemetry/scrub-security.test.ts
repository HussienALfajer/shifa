// Security review follow-ups of 0.2-09b1 (PLT-52): a multi-line exception message never
// survives as a stack "frame", error types and opaque ids are checked by value, and forwarded
// log records carry an error's identifiers and frames but never its message.
import { logs } from '@opentelemetry/api';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { describe, expect, it } from 'vitest';
import { otlpLogForwarder } from '../../src/telemetry/logs.ts';
import { ALLOWED_SPAN_ATTRIBUTES, pickAttributes } from '../../src/telemetry/scrub.ts';
import { stackFrames } from '../../src/telemetry/stack.ts';

const PHONE = '0944123456';
const NAME = 'Fatima Al-Synthetic';
const MESSAGE = `invalid input syntax for type uuid: "Follow-up plan:\n   at home rest, ${NAME} ${PHONE}\n    at fake (x.js:1:2)"`;
const FRAME = '    at handler (/app/dist/main.js:10:5)';

function errorWithMessage(): Error {
  const err = new Error(MESSAGE);
  err.stack = `Error: ${MESSAGE}\n${FRAME}\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)`;
  return err;
}

describe('stackFrames', () => {
  it('cuts a multi-line message, including lines that look like frames', () => {
    const err = errorWithMessage();
    const frames = stackFrames(err.stack ?? '', 'Error', err.message);
    expect(frames).not.toContain(PHONE);
    expect(frames).not.toContain(NAME);
    expect(frames).not.toContain('fake (x.js:1:2)');
    expect(frames.split('\n')).toEqual([
      'Error',
      FRAME,
      '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
    ]);
  });

  it('keeps only strict V8 frames when the message is unknown', () => {
    const stack = `Error: first line\n   at home rest, ${NAME} ${PHONE}\n${FRAME}`;
    expect(stackFrames(stack, 'Error')).toBe(`Error\n${FRAME}`);
  });
});

describe('values of allowed keys', () => {
  it('drops tenant.id and user.id that are not UUIDs', () => {
    const kept = pickAttributes(
      {
        'tenant.id': PHONE,
        'user.id': '0190a8a0-0000-7000-8000-000000000001',
        'http.route': '/x',
      },
      ALLOWED_SPAN_ATTRIBUTES,
    );
    expect(kept).toEqual({ 'user.id': '0190a8a0-0000-7000-8000-000000000001', 'http.route': '/x' });
  });
});

describe('forwarded log records', () => {
  it('carry the error type and frames, never its message', async () => {
    const exporter = new InMemoryLogRecordExporter();
    const provider = new LoggerProvider({
      processors: [new SimpleLogRecordProcessor({ exporter })],
    });
    logs.setGlobalLoggerProvider(provider);
    const err = errorWithMessage();
    otlpLogForwarder().write(
      `${JSON.stringify({
        level: 50,
        time: 1,
        msg: 'request failed',
        err: { type: 'Error', message: err.message, stack: err.stack },
      })}\n`,
    );
    await provider.forceFlush();
    const [record] = exporter.getFinishedLogRecords();
    const exported = JSON.stringify(record?.attributes);
    expect(exported).not.toContain(PHONE);
    expect(exported).not.toContain(NAME);
    expect(JSON.parse(String(record?.attributes['err']))).toEqual({
      type: 'Error',
      stack: `Error\n${FRAME}\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)`,
    });
    await provider.shutdown();
    logs.disable();
  });
});
