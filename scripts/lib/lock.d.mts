// Types for lock.mjs, imported by the TypeScript DB test harness (packages/db/test-harness).
export declare class LockBusyError extends Error {
  constructor(pid: number | null);
  readonly pid: number | null;
}

export declare function acquireLock(
  file: string,
  options?: { waitMs?: number; pollMs?: number },
): Promise<() => void>;

export declare function acquireSlot(
  base: string,
  options: { slots: number; waitMs?: number; pollMs?: number },
): Promise<() => void>;
