// The committed test-set data (criteria 3-4), parsed and checked on load.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');

const numbersFileSchema = z.object({
  description: z.string(),
  numbers: z.array(
    z.object({ n: z.number().int().min(1).max(999), words: z.string().min(1), case: z.string() }),
  ),
});

export const HARD_CASES = ['hamza', 'shadda', 'long-vowel', 'foreign'] as const;

export const nameSchema = z.object({
  id: z.string().regex(/^[mf]\d{2}$/u),
  diacritised: z.string().min(1),
  plain: z.string().min(1),
  gender: z.enum(['male', 'female']),
  origin: z.enum(['arabic', 'kurdish', 'turkmen', 'other']),
  hard: z.array(z.enum(HARD_CASES)),
  alsoPlain: z.boolean(),
  source: z.string().regex(/^https:\/\/\S+$/u),
});

export type NameEntry = z.infer<typeof nameSchema>;

const namesFileSchema = z.object({
  description: z.string(),
  names: z.array(nameSchema),
});

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
}

export const CHOSEN_NUMBERS = numbersFileSchema.parse(readJson('numbers.json')).numbers;
export const NAMES: NameEntry[] = namesFileSchema.parse(readJson('names.json')).names;
