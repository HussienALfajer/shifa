// `bench:render` (criterion 11, report only, no threshold): Gotenberg render time p50/p95 per
// document type, sequential and 5 concurrent, and the container's peak memory. Writes
// `.verify/s3/render-bench.json` (versions, machine, timings; no content). Needs Docker.
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DIGIT_STYLES } from '../src/digits.ts';
import { CHOSEN_FONT, fontVersions } from '../src/fonts.ts';
import { VERIFY_DIR } from '../src/golden.ts';
import { GOTENBERG_IMAGE, startGotenberg } from '../src/gotenberg.ts';
import { startNetwork } from '../src/network.ts';
import { DOCUMENTS, renderInput } from '../src/templates/index.ts';

const N = Number(process.env['BENCH_RENDER_N'] ?? 20);
const CONCURRENCY = 5;
const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
const stats = (times: number[]) => {
  const s = [...times].sort((a, b) => a - b);
  return {
    n: s.length,
    p50_ms: Math.round(pct(s, 50)),
    p95_ms: Math.round(pct(s, 95)),
    max_ms: Math.round(s.at(-1) ?? 0),
  };
};

const network = await startNetwork();
const gotenberg = await startGotenberg(network);
try {
  const results: Record<string, unknown> = {};
  for (const doc of DOCUMENTS) {
    const input = renderInput(doc.id, DIGIT_STYLES[1]);
    await gotenberg.renderPdf(input); // warm-up
    const sequential: number[] = [];
    for (let i = 0; i < N; i += 1) {
      const start = performance.now();
      await gotenberg.renderPdf(input);
      sequential.push(performance.now() - start);
    }
    const concurrent: number[] = [];
    const { peakBytes } = await gotenberg.peakMemory(async () => {
      for (let round = 0; round < Math.ceil(N / CONCURRENCY); round += 1) {
        await Promise.all(
          Array.from({ length: CONCURRENCY }, async () => {
            const start = performance.now();
            await gotenberg.renderPdf(input);
            concurrent.push(performance.now() - start);
          }),
        );
      }
    });
    results[doc.id] = {
      sequential: stats(sequential),
      concurrent_5: stats(concurrent),
      peak_memory_mib_concurrent_5: Math.round(peakBytes / 2 ** 20),
    };
  }
  const report = {
    gotenberg: GOTENBERG_IMAGE,
    gotenberg_version: await gotenberg.version(),
    font: CHOSEN_FONT,
    fonts: fontVersions(),
    renders_per_type: N,
    concurrency: CONCURRENCY,
    machine: {
      cpus: cpus().length,
      cpu: cpus()[0]?.model,
      ram_gb: Math.round(totalmem() / 2 ** 30),
      platform: process.platform,
    },
    results,
  };
  await mkdir(VERIFY_DIR, { recursive: true });
  const path = join(VERIFY_DIR, 'render-bench.json');
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`bench:render: ${JSON.stringify(results)}\nwrote ${path}\n`);
} finally {
  await gotenberg.stop();
  await network.stop();
}
