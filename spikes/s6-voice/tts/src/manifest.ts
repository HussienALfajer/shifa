// The generation manifest (criterion 1): one per provider and voice, next to its clips. The display
// pack (0.3-S6a E) and the listening page (0.3-S6b) read this format; it is fixed here.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { TestSet } from './testset.ts';

export const MANIFEST_SCHEMA_VERSION = 1;

const clipSchema = z.object({
  clipId: z.string().min(1),
  category: z.enum(['chime', 'number', 'room', 'doctor', 'name', 'name-plain', 'pre-round']),
  text: z.string(),
  provider: z.enum(['azure', 'google', 'silma', 'fake']),
  voice: z.string().min(1),
  /** File name relative to the manifest. */
  file: z.string().min(1),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/u)
    .nullable(),
  durationMs: z.number().nonnegative(),
  charactersBilled: z.number().int().nonnegative(),
  elapsedMs: z.number().nonnegative(),
  attempts: z.number().int().nonnegative(),
  status: z.enum(['ok', 'failed']),
  error: z.object({ status: z.number().int(), vendorCode: z.string().optional() }).optional(),
});

export const manifestSchema = z.object({
  header: z.object({
    schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
    provider: z.enum(['azure', 'google', 'silma', 'fake']),
    voice: z.string().min(1),
    set: z.enum(['full', 'pre-round']),
    generatedAt: z.string(),
    /** API endpoint version or image tag the clips came from. */
    apiVersion: z.string(),
    toolVersion: z.string(),
    node: z.string(),
  }),
  clips: z.array(clipSchema),
  announcements: z.array(z.object({ id: z.string(), clipIds: z.array(z.string()) })),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestClip = z.infer<typeof clipSchema>;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * One manifest per set, so the pre-round and the full run of the same voice (the two Chirp voices
 * the owner picks) never overwrite each other. Clip ids of the two sets never collide.
 */
export function manifestFileName(set: 'full' | 'pre-round'): string {
  return set === 'full' ? 'manifest.json' : 'manifest.pre-round.json';
}

export function readManifest(file: string): Manifest {
  return manifestSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export function writeManifest(file: string, manifest: Manifest): void {
  writeFileSync(file, `${JSON.stringify(manifestSchema.parse(manifest), null, 2)}\n`);
}

export interface CompletenessReport {
  ok: boolean;
  /** Planned clips with no entry or no file. */
  missing: string[];
  failed: string[];
  /** Files whose SHA-256 differs from the manifest. */
  mismatched: string[];
}

export function checkCompleteness(
  manifest: Manifest,
  set: TestSet,
  dir: string,
): CompletenessReport {
  const byId = new Map(manifest.clips.map((c) => [c.clipId, c]));
  const missing: string[] = [];
  const failed: string[] = [];
  const mismatched: string[] = [];
  for (const planned of set.clips) {
    const entry = byId.get(planned.id);
    if (!entry) {
      missing.push(planned.id);
      continue;
    }
    if (entry.status === 'failed') {
      failed.push(planned.id);
      continue;
    }
    const file = join(dir, entry.file);
    if (!existsSync(file)) {
      missing.push(planned.id);
      continue;
    }
    if (sha256Hex(readFileSync(file)) !== entry.sha256 || entry.text !== planned.text) {
      mismatched.push(planned.id);
    }
  }
  return {
    ok: missing.length === 0 && failed.length === 0 && mismatched.length === 0,
    missing,
    failed,
    mismatched,
  };
}
