// The files the page downloads: the results JSON (codes, scores, notes, pair choices, times) and
// the pre-round choice. Field for field the strict schemas in @shifa-spike/s6-tts; nothing else.
import type { ListeningResults, ListeningSet, PreRoundChoice } from '@shifa-spike/s6-tts';
import type { Progress } from './state.ts';

type FullSet = Extract<ListeningSet, { kind: 'full' }>;

export function buildResults(set: FullSet, p: Progress): ListeningResults {
  return {
    schemaVersion: 1,
    kind: 'full',
    setHash: set.setHash,
    startedAt: p.startedAt,
    finishedAt: p.finishedAt ?? new Date().toISOString(),
    ratings: set.items.flatMap((item) => {
      const r = p.ratings[item.code];
      if (r?.naturalness === null || r?.naturalness === undefined) return [];
      return [
        {
          code: item.code,
          naturalness: r.naturalness,
          wrong: item.text === undefined ? null : r.wrong,
          note: r.note.slice(0, 500),
          at: r.at,
        },
      ];
    }),
    pairs: set.pairs.flatMap((pair) => {
      const c = p.pairs[pair.id];
      return c ? [{ id: pair.id, choice: c.choice, at: c.at }] : [];
    }),
  };
}

export function buildChoice(setHash: string, male: number, female: number): PreRoundChoice {
  return {
    schemaVersion: 1,
    kind: 'pre-round',
    setHash,
    male,
    female,
    chosenAt: new Date().toISOString(),
  };
}

export function download(fileName: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
