// 0.2-09b2 security review R1: leadingStackFrames() keeps frames only when the stack starts with
// the current message, and only the run of frame lines right after it.
import { describe, expect, it } from 'vitest';
import { leadingStackFrames } from '../../src/telemetry/stack.ts';

const FAKE = '    at Ahmad Khalil (0944123456:12:34)';

function lines(text: string): string[] {
  return text.split('\n');
}

describe('leadingStackFrames', () => {
  it('keeps the real frames after a multi-line message', () => {
    const err = new Error(`Failed query\nparams: Hikmat Khalil,0944123456\n${FAKE}`);
    const out = leadingStackFrames(err.stack ?? '', 'Error', err.message);
    const [type, ...frames] = lines(out);
    expect(type).toBe('Error');
    expect(frames.length).toBeGreaterThan(0);
    expect(out).not.toContain('Khalil');
    expect(out).not.toContain('0944123456');
  });

  it('a message changed after creation yields the type alone', () => {
    const err = new Error(`saving\n${FAKE}`);
    expect(err.stack).toContain('saving'); // V8 formats the stack with the original message
    err.message = `while saving: ${err.message}`;
    expect(leadingStackFrames(err.stack ?? '', 'Error', err.message)).toBe('Error');
  });

  it('stops at the first line that is not a frame (an appended "Caused by:")', () => {
    const err = new Error('outer');
    err.stack = `${err.stack ?? ''}\nCaused by: Error: inner Hikmat\n${FAKE}`;
    const out = leadingStackFrames(err.stack, 'Error', err.message);
    expect(out).not.toContain('Hikmat');
    expect(out).not.toContain('0944123456');
    expect(lines(out).length).toBeGreaterThan(1);
  });

  it('a stack that does not start with an error name yields the type alone', () => {
    expect(leadingStackFrames(`not a header: x\n${FAKE}`, 'Error', 'x')).toBe('Error');
    expect(leadingStackFrames(`Error: other\n${FAKE}`, 'Error', 'x')).toBe('Error');
  });

  it('handles an empty message', () => {
    const err = new Error();
    const out = leadingStackFrames(err.stack ?? '', 'Error', '');
    expect(lines(out).length).toBeGreaterThan(1);
  });
});
