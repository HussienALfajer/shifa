// Defence in depth: values must not reach the log even when code bypasses describeError()
// or hands Nest's logger a stack trace.
import { Logger } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { createLogger, NestPinoLogger } from '../src/platform/logging.ts';
import { captureLogs } from './support.ts';

const MARKER = 'synthetic-value-6610';

function pgLikeError(): Error {
  return Object.assign(new Error(`invalid input syntax for type integer: "${MARKER}"`), {
    name: 'error',
    severity: 'ERROR',
    code: '22P02',
    detail: `Key (phone)=(${MARKER}) already exists.`,
    table: 'patients',
  });
}

describe('log sanitising', () => {
  it('a raw database error logged as err keeps identifiers only', () => {
    const logs = captureLogs();
    createLogger({ level: 'info', destination: logs.stream }).error({ err: pgLikeError() }, 'x');
    expect(logs.text()).toContain('"sqlstate":"22P02"');
    expect(logs.text()).not.toContain(MARKER);
  });

  it("Nest's logger drops a stack trace passed without a context", () => {
    const logs = captureLogs();
    const nest = new NestPinoLogger(createLogger({ level: 'info', destination: logs.stream }));
    const stack = String(pgLikeError().stack);
    nest.error('failed', stack);
    nest.error('failed', stack, 'SomeContext');
    expect(logs.text()).not.toContain(MARKER);
    expect(logs.text()).toContain('"context":"SomeContext"');
  });

  it('works through a Nest Logger instance as the framework uses it', () => {
    const logs = captureLogs();
    Logger.overrideLogger(
      new NestPinoLogger(createLogger({ level: 'info', destination: logs.stream })),
    );
    new Logger('Probe').error('failed', String(pgLikeError().stack));
    Logger.overrideLogger(false);
    expect(logs.text()).toContain('"context":"Probe"');
    expect(logs.text()).not.toContain(MARKER);
  });
});
