// Spike folders. `.out/` and `.env.local` are git-ignored (ADR-0026; audio is never committed).
import { join } from 'node:path';

export const SPIKE_DIR = join(import.meta.dirname, '..', '..');
export const OUT_DIR = join(SPIKE_DIR, '.out');
export const ENV_FILE = join(SPIKE_DIR, '.env.local');
