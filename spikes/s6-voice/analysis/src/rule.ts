// Criterion 6: the report numbers and the OD-50 decision rule. Means come with n and sd; with one
// listener they describe that listener's ratings and support no significance claim.
import type { ListeningKey, ListeningResults } from '@shifa-spike/s6-tts';

export interface Stat {
  n: number;
  mean: number;
  sd: number;
}

export interface WrongClip {
  clipId: string;
  text: string;
  note: string;
}

export interface VoiceSummary {
  voiceId: string;
  provider: string;
  voice: string;
  naturalness: { all: Stat; byCategory: Record<string, Stat> };
  wrongNumbers: WrongClip[];
  /** Diacritised and plain name clips marked wrong. */
  wrongNames: WrongClip[];
  pairs: { wins: number; losses: number; ties: number };
}

export interface FormRate {
  judged: number;
  wrong: number;
  rate: number;
}

export interface TashkeelRates {
  diacritised: FormRate;
  plain: FormRate;
}

export interface Summary {
  voices: VoiceSummary[];
  /** Only the names heard in both forms (20 in the test set). */
  tashkeel: { all: TashkeelRates; byVoice: Record<string, TashkeelRates> };
  ratedClips: number;
  pairsJudged: number;
}

export type Decision =
  | {
      kind: 'winner';
      voiceId: string;
      runnerUp?: string;
      /** Winner's mean naturalness minus the runner-up's. */
      margin: number;
      reason: string;
      /** Voices passed over for a wrong number. */
      excluded?: string[];
      tieBrokenBy?: 'fewer wrong names';
    }
  | { kind: 'tie'; voiceIds: string[] }
  | { kind: 'no-eligible-winner'; wrongNumbers: { voiceId: string; clipIds: string[] }[] };

/** A difference in mean naturalness under this is a tie (OD-50). */
export const TIE_MARGIN = 0.05;

const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

export function stat(xs: number[]): Stat {
  const n = xs.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0 };
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = n < 2 ? 0 : xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return { n, mean: round4(mean), sd: round4(Math.sqrt(variance)) };
}

function rate(judged: number, wrong: number): FormRate {
  return { judged, wrong, rate: judged === 0 ? 0 : round4(wrong / judged) };
}

const byClipId = (a: WrongClip, b: WrongClip) => a.clipId.localeCompare(b.clipId);

export function summarise(results: ListeningResults, key: ListeningKey): Summary {
  const voiceIdOf = (e: { provider: string; voice: string }) => `${e.provider}/${e.voice}`;
  const ratings = results.ratings.map((r) => {
    const entry = key.codes[r.code];
    if (entry?.use !== 'rating') throw new Error(`code not in the key: ${r.code}`);
    return { ...r, entry, voiceId: voiceIdOf(entry) };
  });

  // Names heard in both forms: name-<id> and name-plain-<id>.
  const bothForms = new Set(
    Object.values(key.codes)
      .filter((e) => e.category === 'name-plain')
      .map((e) => e.clipId.replace(/^name-plain-/u, '')),
  );
  const formOf = (clipId: string): 'diacritised' | 'plain' | null => {
    if (clipId.startsWith('name-plain-')) return 'plain';
    if (clipId.startsWith('name-') && bothForms.has(clipId.slice('name-'.length))) {
      return 'diacritised';
    }
    return null;
  };
  const tally = (rs: typeof ratings): TashkeelRates => {
    const count = (form: 'diacritised' | 'plain') => {
      const judged = rs.filter((r) => formOf(r.entry.clipId) === form && r.wrong !== null);
      return rate(judged.length, judged.filter((r) => r.wrong === true).length);
    };
    return { diacritised: count('diacritised'), plain: count('plain') };
  };

  const pairTallies = new Map<string, { wins: number; losses: number; ties: number }>();
  const pairOf = (voiceId: string) => {
    const t = pairTallies.get(voiceId) ?? { wins: 0, losses: 0, ties: 0 };
    pairTallies.set(voiceId, t);
    return t;
  };
  for (const choice of results.pairs) {
    const pair = key.pairs.find((p) => p.id === choice.id);
    if (!pair) throw new Error(`pair not in the key: ${choice.id}`);
    if (choice.choice === 'same') {
      pairOf(pair.a).ties += 1;
      pairOf(pair.b).ties += 1;
    } else {
      const [win, lose] = choice.choice === 'a' ? [pair.a, pair.b] : [pair.b, pair.a];
      pairOf(win).wins += 1;
      pairOf(lose).losses += 1;
    }
  }

  const byVoice: Record<string, TashkeelRates> = {};
  const voices = key.voices.map((v): VoiceSummary => {
    const mine = ratings.filter((r) => r.voiceId === v.voiceId);
    const categories = [...new Set(mine.map((r) => r.entry.category))].sort();
    const wrong = (test: (category: string) => boolean) =>
      mine
        .filter((r) => r.wrong === true && test(r.entry.category))
        .map((r) => ({ clipId: r.entry.clipId, text: r.entry.text, note: r.note }))
        .sort(byClipId);
    byVoice[v.voiceId] = tally(mine);
    return {
      voiceId: v.voiceId,
      provider: v.provider,
      voice: v.voice,
      naturalness: {
        all: stat(mine.map((r) => r.naturalness)),
        byCategory: Object.fromEntries(
          categories.map((c) => [
            c,
            stat(mine.filter((r) => r.entry.category === c).map((r) => r.naturalness)),
          ]),
        ),
      },
      wrongNumbers: wrong((c) => c === 'number'),
      wrongNames: wrong((c) => c === 'name' || c === 'name-plain'),
      pairs: { ...pairOf(v.voiceId) },
    };
  });

  return {
    voices,
    tashkeel: { all: tally(ratings), byVoice },
    ratedClips: ratings.length,
    pairsJudged: results.pairs.length,
  };
}

export function decide(voices: VoiceSummary[]): Decision {
  const eligible = voices.filter((v) => v.wrongNumbers.length === 0);
  const excluded = voices.filter((v) => v.wrongNumbers.length > 0).map((v) => v.voiceId);
  if (eligible.length === 0) {
    return {
      kind: 'no-eligible-winner',
      wrongNumbers: voices.map((v) => ({
        voiceId: v.voiceId,
        clipIds: v.wrongNumbers.map((w) => w.clipId),
      })),
    };
  }
  const ranked = [...eligible].sort((a, b) => b.naturalness.all.mean - a.naturalness.all.mean);
  const top = ranked[0];
  if (!top) throw new Error('no eligible voice');
  const tied = ranked.filter(
    (v) => round4(top.naturalness.all.mean - v.naturalness.all.mean) < TIE_MARGIN,
  );
  const extra = excluded.length > 0 ? { excluded } : {};
  const winner = (w: VoiceSummary, runnerUp: VoiceSummary | undefined, tieBroken: boolean) => ({
    kind: 'winner' as const,
    voiceId: w.voiceId,
    ...(runnerUp ? { runnerUp: runnerUp.voiceId } : {}),
    // After a tie-break the winner may be up to 0.05 behind on naturalness: report the size only.
    margin: runnerUp ? round4(Math.abs(w.naturalness.all.mean - runnerUp.naturalness.all.mean)) : 0,
    reason: tieBroken
      ? 'mean naturalness tied within 0.05; fewer wrong names'
      : 'highest mean naturalness among voices with no wrong number',
    ...extra,
    ...(tieBroken ? { tieBrokenBy: 'fewer wrong names' as const } : {}),
  });
  if (tied.length === 1) return winner(top, ranked[1], false);

  const fewest = Math.min(...tied.map((v) => v.wrongNames.length));
  const best = tied.filter((v) => v.wrongNames.length === fewest);
  if (best.length > 1) return { kind: 'tie', voiceIds: best.map((v) => v.voiceId) };
  const w = best[0];
  if (!w) throw new Error('no best voice');
  return winner(
    w,
    ranked.find((v) => v !== w),
    true,
  );
}
