// One measurement each: a study sent by one method on one profile (fresh stack, so the cloud,
// the upload sessions and the memory peaks start empty), the viewer on every profile, and
// encryption on against off (unshaped). Rows hold counts, bytes and times only.
import { ensureStudy, type StudyName } from '@shifa-spike/s4-generator';
import { PROFILES, type ProfileName, type Stack, startStack } from '@shifa-spike/s4-stack';
import {
  cloudCount,
  cloudStudy,
  connectBrowser,
  firstImage,
  mprReady,
  openUploadPage,
  openViewer,
  selectAndStart,
  stowFiles,
  totals,
  waitOutcome,
} from '../src/index.ts';
import type { EncryptionRow, Method, TransferRow, ViewerRow } from './bench.ts';
import { sampleMemory } from './memory.ts';

/** The spec's P1 cuts (30 s every 5 min, line drops); none on P2 and P3. */
const CUTS = { everySeconds: 300, cutSeconds: 30, offsetSeconds: 120 };

export interface TransferPlan {
  profile: ProfileName;
  study: StudyName;
  method: Method;
  /** Chunk size of the chunked methods (default: the gateway's 1 MiB). */
  chunkBytes?: number;
  /** The edge's Transfers bucket size (default 512 KB, two threads). */
  bucketKb?: number;
  timeoutMs: number;
}

const mbit = (bytes: number, ms: number) => (bytes * 8) / (ms * 1000);
const round = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits;

export async function measureTransfer(plan: TransferPlan): Promise<TransferRow> {
  const { dir, manifest } = await ensureStudy(plan.study);
  const studyBytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
  const edge = plan.method === 'edge';
  const stack = await startStack({
    profile: plan.profile,
    ops: false,
    browser: !edge,
    edge,
    ...(plan.bucketKb ? { edgeTransfers: { bucketKb: plan.bucketKb, threads: 2 } } : {}),
  });
  try {
    if (edge) {
      // C-STORE into the edge crosses the clinic LAN only, so it is outside the timing.
      await stack.edge?.storescu(
        dir,
        manifest.files.map((f) => f.path),
      );
    }
    const memory = sampleMemory({
      orthanc: stack.tenants.a.container,
      gateway: stack.gateway.container,
      ...(stack.edge ? { edge: stack.edge.container } : {}),
    });
    const before = await stack.link.counters();
    const stop = plan.profile === 'P1' ? stack.link.schedule(CUTS) : () => Promise.resolve();
    const started = Date.now();
    let sent: Awaited<ReturnType<typeof send>>;
    try {
      sent = await send(stack, plan, dir);
    } finally {
      await stop();
    }
    const ms = Date.now() - started;
    const peak = await memory();
    const after = await stack.link.counters();
    await stack.link.applyProfile('none');
    // Instances the cloud lists (QIDO-RS); null when the check itself failed.
    const stored = await cloudCount(stack, 'a', manifest.studyInstanceUid).catch(() => null);
    const wireUpBytes = after.upBytes - before.upBytes;
    const upMbit = PROFILES[plan.profile].upMbit;
    return {
      kind: 'transfer',
      profile: plan.profile,
      study: plan.study,
      method: plan.method,
      chunkBytes: edge || plan.method === 'stow' ? null : (plan.chunkBytes ?? 1024 * 1024),
      bucketKb: edge ? (plan.bucketKb ?? 512) : null,
      outcome: sent.outcome,
      ms,
      files: manifest.files.length,
      storedInstances: stored,
      studyBytes,
      linkUpMbit: upMbit,
      throughputMbit: round(mbit(studyBytes, ms)),
      efficiency: round(mbit(studyBytes, ms) / upMbit),
      wireUpBytes,
      wireDownBytes: after.downBytes - before.downBytes,
      wireRatio: round(wireUpBytes / studyBytes),
      resentBytes: sent.resentBytes,
      interruptions: sent.interruptions,
      cuts: stack.link.events.filter((e) => e.event === 'cut-start').length,
      peakMemMiB: {
        orthanc: peak['orthanc'] ?? 0,
        gateway: peak['gateway'] ?? 0,
        ...(peak['edge'] === undefined ? {} : { edge: peak['edge'] }),
      },
    };
  } finally {
    await stack.stop();
  }
}

interface Sent {
  outcome: TransferRow['outcome'];
  /** Body bytes sent beyond what the server kept (browser); null for the edge. */
  resentBytes: number | null;
  /** Interrupted files (browser) or resubmitted push jobs (edge). */
  interruptions: number;
}

async function send(stack: Stack, plan: TransferPlan, dir: string): Promise<Sent> {
  if (plan.method === 'edge') return push(stack, plan);
  const browser = await connectBrowser(stack);
  try {
    const upload = await openUploadPage(browser, stack, {
      tenant: 'a',
      mode: plan.method === 'stow' ? 'stow' : 'chunked',
      ...(plan.chunkBytes ? { chunkSize: plan.chunkBytes } : {}),
      ...(plan.method === 'chunked-par3' ? { parallel: 3 } : {}),
    });
    await selectAndStart(upload.page, dir);
    const outcome = await waitOutcome(upload.page, plan.timeoutMs).catch(() => 'timeout' as const);
    const sum = totals(upload.loads);
    return {
      outcome,
      resentBytes: sum.sentBytes - sum.ackedBytes,
      interruptions: sum.interrupted.length,
    };
  } finally {
    await browser.close();
  }
}

async function push(stack: Stack, plan: TransferPlan): Promise<Sent> {
  const edge = stack.edge;
  if (!edge) throw new Error('edge not started');
  const { manifest } = await ensureStudy(plan.study);
  const started = Date.now();
  let job = await edge.push(manifest.studyInstanceUid);
  let resubmits = 0;
  while (Date.now() - started < plan.timeoutMs) {
    const current = await edge.job(job);
    if (current.State === 'Success')
      return { outcome: 'done', resentBytes: null, interruptions: resubmits };
    if (current.State === 'Failure') {
      resubmits += 1;
      job = await edge.resubmit(job);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return { outcome: 'timeout', resentBytes: null, interruptions: resubmits };
}

/**
 * The panoramic and each multi-file CBCT stored once (unshaped), then opened through the
 * gateway on every profile and on the edge LAN: time to first image and to MPR ready.
 */
export async function measureViewer(
  profiles: ProfileName[],
  studies: StudyName[],
  timeoutMs: number,
): Promise<ViewerRow[]> {
  const stack = await startStack({ ops: false, browser: true, ohif: true, edge: true });
  const rows: ViewerRow[] = [];
  try {
    const edge = stack.edge;
    if (!edge) throw new Error('edge not started');
    const names: StudyName[] = ['pano', ...studies.filter((s) => s.endsWith('-multi'))];
    const uids = new Map<StudyName, string>();
    for (const name of names) {
      const { dir, manifest } = await ensureStudy(name);
      const paths = manifest.files.map((f) => f.path);
      await stowFiles(stack, 'a', dir, paths);
      await edge.storescu(dir, paths);
      uids.set(name, manifest.studyInstanceUid);
    }
    const browser = await connectBrowser(stack);
    try {
      const places: { place: string; profile: ProfileName | 'none' }[] = [
        ...profiles.map((p) => ({ place: p, profile: p })),
        { place: 'edge LAN', profile: 'none' },
      ];
      for (const { place, profile } of places) {
        await stack.link.applyProfile(profile);
        const via = place === 'edge LAN' ? { edge: true as const } : { gateway: 'a' as const };
        for (const name of names) {
          const mpr = name !== 'pano';
          const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
          const page = await context.newPage();
          let firstImageMs: number | null = null;
          let mprReadyMs: number | null = null;
          try {
            const start = await openViewer(page, stack, {
              studyUid: uids.get(name) ?? '',
              mpr,
              via,
            });
            firstImageMs = await firstImage(page, start, timeoutMs);
            if (mpr) mprReadyMs = await mprReady(page, start, timeoutMs);
          } catch {
            // Recorded as missing (timeout); the report says so.
          } finally {
            await context.close();
          }
          rows.push({ kind: 'viewer', place, study: name, firstImageMs, mprReadyMs });
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    await stack.stop();
  }
  return rows;
}

/**
 * Encryption overhead: tenant a encrypts, tenant b does not; the same study is stored into
 * each by STOW-RS and read back by WADO-RS, unshaped, through the gateway.
 */
export async function measureEncryption(studies: StudyName[]): Promise<EncryptionRow[]> {
  const stack = await startStack({ ops: false, storageEncryption: { a: true, b: false } });
  const rows: EncryptionRow[] = [];
  try {
    for (const study of studies) {
      const { dir, manifest } = await ensureStudy(study);
      const paths = manifest.files.map((f) => f.path);
      // Off first, then on: a warm cache would favour the second run, not encryption.
      for (const tenant of ['b', 'a'] as const) {
        const memory = sampleMemory({ orthanc: stack.tenants[tenant].container });
        let started = Date.now();
        await stowFiles(stack, tenant, dir, paths);
        const storeMs = Date.now() - started;
        started = Date.now();
        const read = await cloudStudy(stack, tenant, manifest.studyInstanceUid);
        const readMs = Date.now() - started;
        const peak = await memory();
        if (read.size !== manifest.files.length) throw new Error('encryption read incomplete');
        rows.push({
          kind: 'encryption',
          study,
          encrypted: tenant === 'a',
          storeMs,
          readMs,
          studyBytes: manifest.files.reduce((n, f) => n + f.bytes, 0),
          peakOrthancMiB: peak['orthanc'] ?? 0,
        });
      }
    }
  } finally {
    await stack.stop();
  }
  return rows;
}
