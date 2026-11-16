// Criterion 9, "false matches the new rules add": how many distinct synthetic display names
// share a key only because of the OD-40 rules (particle joining, word-final ة/ى folding).
// The baseline hides ة, ى and spaces from those rules; counts only go to .verify/s3/.
import { DEFAULT_LOAD_PARAMS } from '@shifa/testing';
import { describe, expect, it } from 'vitest';
import { normaliseName } from '../src/normalise.ts';
import { writeReport } from '../src/report.ts';
import { syntheticPatients } from '../src/seed.ts';

/** The key without the OD-40 rules: ة/ى kept out of word-final folding, no particle joining. */
const withoutOd40 = (name: string) =>
  normaliseName(
    name
      .replace(/\u{0629}/gu, '\u{E000}')
      .replace(/\u{0649}/gu, '\u{E001}')
      .replace(/ /g, '_'),
  );

describe('OD-40 merges on the load preset', () => {
  it('counts distinct names merged into one key by the OD-40 rules', async () => {
    const names = [...new Set(syntheticPatients(DEFAULT_LOAD_PARAMS).map((p) => p.displayName))];
    const byKey = new Map<string, Set<string>>();
    for (const name of names) {
      const key = normaliseName(name);
      byKey.set(key, (byKey.get(key) ?? new Set<string>()).add(withoutOd40(name)));
    }
    const merged = [...byKey.values()].filter((baselines) => baselines.size > 1);
    const report = {
      distinct_names: names.length,
      distinct_keys: byKey.size,
      keys_merged_by_od40: merged.length,
      names_in_merged_keys: merged.reduce((sum, set) => sum + set.size, 0),
    };
    await writeReport('od40-merges.json', report);
    expect(report.distinct_names).toBeGreaterThan(40_000);
  });
});
