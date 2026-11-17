// Peak memory of named containers while a measurement runs, from `docker stats` (one sample
// about every few seconds; `docker stats --no-stream` itself takes a second or two).
import { docker } from '@shifa-spike/s4-stack';

const UNITS: Record<string, number> = {
  B: 1 / 1024 / 1024,
  KiB: 1 / 1024,
  MiB: 1,
  GiB: 1024,
  kB: 1000 / 1024 / 1024,
  MB: 1_000_000 / 1024 / 1024,
  GB: 1_000_000_000 / 1024 / 1024,
};

/** "123.4MiB / 15.47GiB" → 123.4 (MiB). */
export function parseMemUsage(usage: string): number {
  const match = /^\s*([\d.]+)\s*([A-Za-z]+)/.exec(usage);
  const factor = UNITS[match?.[2] ?? ''];
  if (!match || factor === undefined) return 0;
  return Number(match[1]) * factor;
}

/**
 * Starts sampling the containers (label → container name); the returned stop resolves to the
 * peak per label in MiB, rounded to one decimal.
 */
export function sampleMemory(
  containers: Record<string, string>,
  everyMs = 3000,
): () => Promise<Record<string, number>> {
  const peak: Record<string, number> = Object.fromEntries(
    Object.keys(containers).map((label) => [label, 0]),
  );
  const byName = new Map(Object.entries(containers).map(([label, name]) => [name, label]));
  const state = { stopped: false };
  const loop = (async () => {
    while (!state.stopped) {
      const res = await docker(
        ['stats', '--no-stream', '--format', '{{.Name}}\t{{.MemUsage}}', ...byName.keys()],
        { check: false, timeoutMs: 30_000 },
      );
      for (const line of res.stdout.split('\n')) {
        const [name, usage] = line.split('\t');
        const label = byName.get(name ?? '');
        if (label !== undefined && usage) {
          peak[label] = Math.max(peak[label] ?? 0, parseMemUsage(usage));
        }
      }
      await new Promise((resolve) => setTimeout(resolve, everyMs));
    }
  })();
  return async () => {
    state.stopped = true;
    await loop;
    return Object.fromEntries(
      Object.entries(peak).map(([label, mib]) => [label, Math.round(mib * 10) / 10]),
    );
  };
}
