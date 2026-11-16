// The shared vector file (kept for Phase A): both normaliser ports and the SQL function must
// give `key` for every `input`.
import { readFileSync } from 'node:fs';

export interface VectorCase {
  id: string;
  rule: string;
  input: string;
  key: string;
  note?: string;
}

export interface VectorFile {
  version: number;
  rules: { id: string; description: string }[];
  cases: VectorCase[];
}

export const VECTORS_PATH = new URL('../../vectors/name-search-vectors.json', import.meta.url);

export function loadVectors(): VectorFile {
  return JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as VectorFile;
}
