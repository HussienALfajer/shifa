// Builds a small key and results pair for the analysis tests: voices with chosen scores and wrong
// clips, so each case of the decision rule (OD-50) can be stated in a few lines.
import type { ListeningKey, ListeningResults } from '@shifa-spike/s6-tts';

export interface VoiceSpec {
  /** Naturalness for every clip of this voice, or per clip id. */
  score: number | Record<string, number>;
  /** Clip ids the listener marked wrong. */
  wrong?: string[];
}

export const CLIPS = [
  { clipId: 'number-001', category: 'number', text: 'الرقم واحد' },
  { clipId: 'number-111', category: 'number', text: 'الرقم مئة وأحد عشر' },
  { clipId: 'room-1', category: 'room', text: 'إلى العيادة رقم واحد' },
  { clipId: 'name-m01', category: 'name', text: 'أَحْمَد' },
  { clipId: 'name-f01', category: 'name', text: 'فَاطِمَة' },
  { clipId: 'name-m02', category: 'name', text: 'خَالِد' },
  { clipId: 'name-plain-m01', category: 'name-plain', text: 'أحمد' },
  { clipId: 'name-plain-f01', category: 'name-plain', text: 'فاطمة' },
] as const;

const JUDGED = new Set(['number', 'name', 'name-plain']);
export const SET_HASH = '0123456789abcdef';

function code(voiceIndex: number, clipIndex: number): string {
  // Fixed fake codes in the builder's alphabet (A-Z, 2-7).
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `K${letters[voiceIndex] ?? 'Z'}${letters[clipIndex] ?? 'Z'}AAAAA`;
}

export function makeFixture(
  voices: Record<string, VoiceSpec>,
  pairs: { a: string; b: string; choice: 'a' | 'b' | 'same' }[] = [],
): { key: ListeningKey; results: ListeningResults } {
  const key: ListeningKey = {
    schemaVersion: 1,
    kind: 'full',
    setHash: SET_HASH,
    seed: 1,
    voices: Object.keys(voices).map((voiceId) => {
      const [provider = 'fake', voice = ''] = voiceId.split('/');
      return { voiceId, provider: provider as 'fake', voice };
    }),
    codes: {},
    pairs: [],
  };
  const results: ListeningResults = {
    schemaVersion: 1,
    kind: 'full',
    setHash: SET_HASH,
    startedAt: '2026-11-20T09:00:00.000Z',
    finishedAt: '2026-11-20T10:30:00.000Z',
    ratings: [],
    pairs: [],
  };
  Object.entries(voices).forEach(([voiceId, spec], v) => {
    const [provider = 'fake', voice = ''] = voiceId.split('/');
    CLIPS.forEach((clip, c) => {
      const k = code(v, c);
      key.codes[k] = { ...clip, provider: provider as 'fake', voice, use: 'rating' };
      const score = typeof spec.score === 'number' ? spec.score : (spec.score[clip.clipId] ?? 3);
      const wrong = spec.wrong?.includes(clip.clipId) ?? false;
      results.ratings.push({
        code: k,
        naturalness: score,
        wrong: JUDGED.has(clip.category) ? wrong : null,
        note: wrong ? `${clip.clipId} misread` : '',
        at: '2026-11-20T09:10:00.000Z',
      });
    });
  });
  pairs.forEach((p, i) => {
    const id = `p${String(i + 1).padStart(2, '0')}`;
    key.pairs.push({ id, announcementId: 'ann-01', a: p.a, b: p.b });
    results.pairs.push({ id, choice: p.choice, at: '2026-11-20T10:20:00.000Z' });
  });
  return { key, results };
}
