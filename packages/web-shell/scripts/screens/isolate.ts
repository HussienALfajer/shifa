// Each board of the screens canvas runs its own copy of clinic web in its own document, but every
// board shares one origin: storage and BroadcastChannel would carry one board's theme, remembered
// phone and «signed out» message to the others. Imported first by the entry, before the shell's
// modules open their channels: each board gets storage in memory and a channel that reaches no one.

class MemoryStorage implements Storage {
  readonly #items = new Map<string, string>();

  get length(): number {
    return this.#items.size;
  }

  clear(): void {
    this.#items.clear();
  }

  getItem(key: string): string | null {
    return this.#items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#items.set(key, value);
  }
}

/** A channel of one board: what it posts reaches no other board. */
class BoardChannel extends EventTarget {
  readonly name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    super();
    this.name = name;
  }

  postMessage(): void {
    // Nothing: the other boards are other people's screens, not this person's tabs.
  }

  close(): void {
    // Nothing to close.
  }
}

export const boardStorage = new MemoryStorage();

/**
 * Time passing on this board only: a state that comes after minutes without activity (the idle
 * warning) is reached by moving the board's clock on, never by changing the app's limits.
 */
let ahead = 0;
const realNow = Date.now.bind(Date);
Date.now = () => realNow() + ahead;
export function advanceClock(ms: number): void {
  ahead += ms;
}
/** A new state starts at the real time. */
export function resetClock(): void {
  ahead = 0;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === 'localStorage' ? boardStorage : new MemoryStorage(),
  });
}
Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: BoardChannel });
