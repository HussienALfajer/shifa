// Criterion 7 (VOX-13, VOX-16): the pure call queue with a fake clock.
import { describe, expect, it } from 'vitest';
import { type Call, CallQueue, createSeenStore, type KeyValueStorage } from '../src/queue.ts';

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function setup(storage = memoryStorage()) {
  const clock = { wall: 1_000_000 };
  const queue = new CallQueue({
    now: () => clock.wall,
    seen: createSeenStore(storage),
    gapMs: 1500,
    staleMs: 60_000,
  });
  const call = (callId: string, ageMs = 0): Call => ({
    callId,
    number: 7,
    room: 2,
    issuedAt: clock.wall - ageMs,
  });
  return { clock, queue, call, storage };
}

describe('CallQueue', () => {
  it('plays calls in FIFO order, one at a time', () => {
    const { queue, call } = setup();
    for (const id of ['a', 'b', 'c']) expect(queue.offer(call(id))).toEqual({ accepted: true });
    const first = queue.next(0);
    expect(first?.call.callId).toBe('a');
    expect(queue.next(10)).toBeUndefined(); // 'a' still playing
    queue.finished('a', 2000);
    expect(queue.next(2001)?.call.callId).toBe('b');
    queue.finished('b', 5000);
    expect(queue.next(5001)?.call.callId).toBe('c');
    queue.finished('c', 8000);
    expect(queue.next(9000)).toBeUndefined();
  });

  it('starts the next call no sooner than 1.5 s after the previous end', () => {
    const { queue, call } = setup();
    queue.offer(call('a'));
    queue.offer(call('b'));
    const a = queue.next(100);
    expect(a?.startAtMs).toBe(150); // a short lead so the first clip is never clipped
    queue.finished('a', 2400);
    const b = queue.next(2410);
    expect(b?.startAtMs).toBe(3900);
    queue.finished('b', 5000);
    queue.offer(call('c'));
    // Long idle: the lead applies, not the gap.
    expect(queue.next(20_000)?.startAtMs).toBe(20_050);
  });

  it('drops a duplicate call_id: queued, playing or finished', () => {
    const { queue, call } = setup();
    queue.offer(call('a'));
    expect(queue.offer(call('a'))).toEqual({ accepted: false, reason: 'duplicate' });
    queue.next(0);
    expect(queue.offer(call('a'))).toEqual({ accepted: false, reason: 'duplicate' });
    queue.finished('a', 1000);
    expect(queue.offer(call('a'))).toEqual({ accepted: false, reason: 'duplicate' });
  });

  it('drops a call older than 60 s by issuedAt: 60 000 ms is kept, 60 001 ms is dropped', () => {
    const { queue, call, clock } = setup();
    expect(queue.offer(call('edge', 60_000))).toEqual({ accepted: true });
    expect(queue.offer(call('old', 60_001))).toEqual({ accepted: false, reason: 'stale' });
    // A call that goes stale while waiting is dropped when its turn comes.
    queue.offer(call('waits'));
    expect(queue.next(0)?.call.callId).toBe('edge');
    clock.wall += 61_000;
    queue.finished('edge', 1000);
    expect(queue.next(3000)).toBeUndefined();
    expect(queue.dropped.map((d) => [d.callId, d.reason])).toEqual([
      ['old', 'stale'],
      ['waits', 'stale'],
    ]);
  });

  it('keeps finished call ids across a reload, but not calls that never finished', () => {
    const storage = memoryStorage();
    const before = setup(storage);
    before.queue.offer(before.call('a'));
    before.queue.offer(before.call('b'));
    before.queue.next(0);
    before.queue.finished('a', 1000);
    before.queue.next(2600); // 'b' playing when the page reloads

    const after = setup(storage);
    expect(after.queue.offer(after.call('a'))).toEqual({ accepted: false, reason: 'duplicate' });
    expect(after.queue.offer(after.call('b'))).toEqual({ accepted: true });
  });
});
