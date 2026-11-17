// Bench (0.3-S4c, criterion 11; throwaway spike code): per profile × study × method the
// transfer time, effective throughput against the link rate, bytes on the wire against study
// bytes and bytes sent again after cuts; viewer time to first image and to MPR ready;
// encryption on against off; peak memory of Orthanc, the gateway and the edge. Writes
// `.verify/s4/bench.json` after every row (a long run that dies keeps what it measured), with
// the machine and the versions. No thresholds: the report reads the numbers.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { dirname } from 'node:path';
import { ensureStudy, type StudyName } from '@shifa-spike/s4-generator';
import { docker, IMAGES, type ImageKey, type ProfileName } from '@shifa-spike/s4-stack';
import { measureEncryption, measureTransfer, measureViewer } from './measure.ts';

/**
 * chunked: the resumable protocol, one file at a time; chunked-par3: three files at once;
 * stow: STOW-RS per instance (six requests at once); edge: Transfers push from the edge box.
 */
export const METHODS = ['chunked', 'chunked-par3', 'stow', 'edge'] as const;
export type Method = (typeof METHODS)[number];

export interface TransferRow {
  kind: 'transfer';
  profile: ProfileName;
  study: StudyName;
  method: Method;
  chunkBytes: number | null;
  bucketKb: number | null;
  outcome: 'done' | 'failed' | 'timeout';
  ms: number;
  files: number;
  /** Instances the cloud lists afterwards (QIDO-RS, unshaped); null if that check failed. */
  storedInstances: number | null;
  studyBytes: number;
  linkUpMbit: number;
  throughputMbit: number;
  /** Throughput over the profile's uplink rate. */
  efficiency: number;
  wireUpBytes: number;
  wireDownBytes: number;
  /** Uplink bytes over study bytes (TCP/IP and HTTP framing, re-sends, Transfers' gzip). */
  wireRatio: number;
  resentBytes: number | null;
  interruptions: number;
  cuts: number;
  peakMemMiB: { orthanc: number; gateway: number; edge?: number };
}

export interface ViewerRow {
  kind: 'viewer';
  /** A profile through the gateway, or `edge LAN`. */
  place: string;
  study: StudyName;
  /** null: not rendered within the timeout. */
  firstImageMs: number | null;
  mprReadyMs: number | null;
}

export interface EncryptionRow {
  kind: 'encryption';
  study: StudyName;
  encrypted: boolean;
  storeMs: number;
  readMs: number;
  studyBytes: number;
  peakOrthancMiB: number;
}

export type BenchRow = TransferRow | ViewerRow | EncryptionRow;

export interface BenchFile {
  startedAt: string;
  finishedAt: string | null;
  machine: {
    platform: string;
    release: string;
    arch: string;
    cpus: number;
    cpuModel: string;
    memoryGiB: number;
    docker: string;
  };
  versions: Record<ImageKey | 'playwright', string>;
  options: Omit<BenchOptions, 'out'>;
  /** Time to make (or find and check) each study before the runs. */
  studies: { study: StudyName; ensureMs: number; bytes: number; files: number }[];
  rows: BenchRow[];
}

export interface BenchOptions {
  profiles: ProfileName[];
  studies: StudyName[];
  methods: Method[];
  viewer: boolean;
  encryption: boolean;
  /** Extra chunked runs with these chunk sizes, on `variantProfile` × the first study. */
  chunkSizes?: number[];
  /** Extra edge runs with these Transfers bucket sizes (KB), same place. */
  bucketSizesKb?: number[];
  variantProfile?: ProfileName;
  /** Per transfer or viewer measurement. Default 4 hours. */
  timeoutMs?: number;
  out: string;
}

async function machine(): Promise<BenchFile['machine']> {
  const info = await docker(
    ['version', '--format', '{{.Server.Version}} kernel {{.Server.KernelVersion}}'],
    { check: false },
  );
  return {
    platform: platform(),
    release: release(),
    arch: arch(),
    cpus: cpus().length,
    cpuModel: cpus()[0]?.model.trim() ?? '',
    memoryGiB: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
    docker: info.stdout.trim(),
  };
}

function playwrightVersion(): string {
  const require = createRequire(import.meta.url);
  return (require('playwright/package.json') as { version: string }).version;
}

export async function runBench(options: BenchOptions): Promise<BenchFile> {
  const { out, ...recorded } = options;
  const timeoutMs = options.timeoutMs ?? 4 * 3600_000;
  const file: BenchFile = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    machine: await machine(),
    versions: { ...IMAGES, playwright: playwrightVersion() },
    options: recorded,
    studies: [],
    rows: [],
  };
  const save = async () => {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, `${JSON.stringify(file, null, 2)}\n`);
  };

  for (const study of options.studies) {
    const started = Date.now();
    const { manifest } = await ensureStudy(study);
    file.studies.push({
      study,
      ensureMs: Date.now() - started,
      bytes: manifest.files.reduce((n, f) => n + f.bytes, 0),
      files: manifest.files.length,
    });
  }
  await save();

  for (const profile of options.profiles) {
    for (const study of options.studies) {
      for (const method of options.methods) {
        file.rows.push(await measureTransfer({ profile, study, method, timeoutMs }));
        await save();
      }
    }
  }

  const [first] = options.studies;
  const variantProfile = options.variantProfile ?? 'P3';
  if (first) {
    for (const chunkBytes of options.chunkSizes ?? []) {
      const plan = { profile: variantProfile, study: first, method: 'chunked' as const };
      file.rows.push(await measureTransfer({ ...plan, chunkBytes, timeoutMs }));
      await save();
    }
    for (const bucketKb of options.bucketSizesKb ?? []) {
      const plan = { profile: variantProfile, study: first, method: 'edge' as const };
      file.rows.push(await measureTransfer({ ...plan, bucketKb, timeoutMs }));
      await save();
    }
  }

  if (options.viewer) {
    file.rows.push(...(await measureViewer(options.profiles, options.studies, timeoutMs)));
    await save();
  }
  if (options.encryption) {
    file.rows.push(...(await measureEncryption(options.studies)));
    await save();
  }
  file.finishedAt = new Date().toISOString();
  await save();
  return file;
}
