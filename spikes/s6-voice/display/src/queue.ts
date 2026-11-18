// The call queue (VOX-13, VOX-16): FIFO, one call at a time, the next no sooner than 1.5 s after
// the previous end; a duplicate call_id (queued, playing or finished) or a call older than 60 s by
// issuedAt is dropped. Finished ids survive a reload (sessionStorage), so a reload mid-queue never
// replays a finished call. Pure: wall clock injected, audio times passed in (milliseconds).

export interface Call {
  callId: string;
  number: number;
  room: number;
  nameClipId?: string;
  /** Wall-clock ms when reception issued the call. */
  issuedAt: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SeenStore {
  has(callId: string): boolean;
  add(callId: string): void;
}

const SEEN_ITEM = 's6-seen-call-ids';
const SEEN_MAX = 500;

export function createSeenStore(storage: KeyValueStorage): SeenStore {
  const read = (): string[] => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(SEEN_ITEM) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  };
  return {
    has: (id) => read().includes(id),
    add: (id) => {
      const ids = read();
      if (!ids.includes(id)) ids.push(id);
      storage.setItem(SEEN_ITEM, JSON.stringify(ids.slice(-SEEN_MAX)));
    },
  };
}

export type DropReason = 'duplicate' | 'stale';
export type OfferResult = { accepted: true } | { accepted: false; reason: DropReason };

export interface QueueOptions {
  now: () => number;
  seen: SeenStore;
  gapMs?: number;
  staleMs?: number;
  /** Lead before the first clip, so it is never clipped. */
  leadMs?: number;
}

export class CallQueue {
  readonly dropped: { callId: string; reason: DropReason }[] = [];
  private readonly waiting: Call[] = [];
  private playing: Call | undefined;
  private lastEndMs = Number.NEGATIVE_INFINITY;
  private readonly gapMs: number;
  private readonly staleMs: number;
  private readonly leadMs: number;

  constructor(private readonly opts: QueueOptions) {
    this.gapMs = opts.gapMs ?? 1500;
    this.staleMs = opts.staleMs ?? 60_000;
    this.leadMs = opts.leadMs ?? 50;
  }

  get length(): number {
    return this.waiting.length;
  }

  get current(): Call | undefined {
    return this.playing;
  }

  private isStale(call: Call): boolean {
    return this.opts.now() - call.issuedAt > this.staleMs;
  }

  private drop(callId: string, reason: DropReason): OfferResult {
    this.dropped.push({ callId, reason });
    return { accepted: false, reason };
  }

  offer(call: Call): OfferResult {
    const id = call.callId;
    if (
      this.opts.seen.has(id) ||
      this.playing?.callId === id ||
      this.waiting.some((c) => c.callId === id)
    ) {
      return this.drop(id, 'duplicate');
    }
    if (this.isStale(call)) return this.drop(id, 'stale');
    this.waiting.push(call);
    return { accepted: true };
  }

  /** The next call to start and when (audio ms), or undefined while one plays or none waits. */
  next(audioNowMs: number): { call: Call; startAtMs: number } | undefined {
    if (this.playing) return undefined;
    for (let call = this.waiting.shift(); call; call = this.waiting.shift()) {
      if (this.isStale(call)) {
        this.drop(call.callId, 'stale');
        continue;
      }
      this.playing = call;
      return { call, startAtMs: Math.max(audioNowMs + this.leadMs, this.lastEndMs + this.gapMs) };
    }
    return undefined;
  }

  finished(callId: string, endMs: number): void {
    if (this.playing?.callId !== callId) return;
    this.playing = undefined;
    this.lastEndMs = endMs;
    this.opts.seen.add(callId);
  }
}
