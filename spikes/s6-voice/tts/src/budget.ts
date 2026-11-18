// Free tiers only (OD-50): a local ledger in the untracked output folder adds up this month's
// billed characters per provider; a run that would pass the free limit is refused before any call.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { ProviderName } from './provider.ts';

/** Azure F0: 500,000 characters per month; Google Chirp 3 HD: 1,000,000 free per month. */
export const FREE_LIMITS: Record<ProviderName, number> = {
  azure: 500_000,
  google: 1_000_000,
  silma: Number.POSITIVE_INFINITY,
  fake: Number.POSITIVE_INFINITY,
};

const entrySchema = z.object({
  provider: z.enum(['azure', 'google', 'silma', 'fake']),
  /** YYYY-MM, UTC */
  month: z.string().regex(/^\d{4}-\d{2}$/u),
  characters: z.number().int().nonnegative(),
});

export type LedgerEntry = z.infer<typeof entrySchema>;

export const ledgerFile = (outDir: string) => join(outDir, 'ledger.json');
export const monthKey = (date: Date) => date.toISOString().slice(0, 7);

export function readLedger(file: string): LedgerEntry[] {
  if (!existsSync(file)) return [];
  return z.array(entrySchema).parse(JSON.parse(readFileSync(file, 'utf8')));
}

export function recordUsage(file: string, entry: LedgerEntry): void {
  const entries = readLedger(file);
  entries.push(entrySchema.parse(entry));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`);
}

export interface BudgetCheck {
  allowed: boolean;
  used: number;
  planned: number;
  limit: number;
}

export function checkBudget(
  file: string,
  provider: ProviderName,
  month: string,
  planned: number,
): BudgetCheck {
  const used = readLedger(file)
    .filter((e) => e.provider === provider && e.month === month)
    .reduce((sum, e) => sum + e.characters, 0);
  const limit = FREE_LIMITS[provider];
  return { allowed: used + planned <= limit, used, planned, limit };
}
