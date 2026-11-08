// Unit test (no Docker): a missing container runtime becomes a clear setup message.
import { describe, expect, it } from 'vitest';
import { DOCKER_MISSING, explainStartFailure } from '../test-harness/docker.ts';

describe('explainStartFailure', () => {
  it('explains a missing Docker runtime', () => {
    const cause = new Error('Could not find a working container runtime strategy');
    const explained = explainStartFailure(cause);
    expect(explained).toBeInstanceOf(Error);
    expect((explained as Error).message).toBe(DOCKER_MISSING);
    expect((explained as Error).cause).toBe(cause);
  });

  it('passes other failures through unchanged', () => {
    const other = new Error('pull access denied');
    expect(explainStartFailure(other)).toBe(other);
  });
});
