// Progress of one listening run, saved to localStorage on every change and keyed by the set hash,
// so a reload (or a new browser tab) resumes where the owner stopped. No listener identity.

export interface Rating {
  naturalness: number | null;
  /** null where the clip is not judged (rooms, doctors) or not yet answered. */
  wrong: boolean | null;
  note: string;
  heard: boolean;
  at: string;
}

export interface Progress {
  setHash: string;
  startedAt: string;
  finishedAt: string | null;
  phase: 'rating' | 'pairs' | 'done';
  index: number;
  pairIndex: number;
  ratings: Record<string, Rating>;
  pairs: Record<string, { choice: 'a' | 'b' | 'same'; at: string }>;
}

export interface PreRoundProgress {
  setHash: string;
  male: number | null;
  female: number | null;
}

const PREFIX = 's6-listening:';

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the run continues; the owner is warned on the page.
    document.body.dataset['storage'] = 'failed';
  }
}

export function loadProgress(setHash: string): Progress {
  const saved = read(`full:${setHash}`) as Progress | null;
  if (saved?.setHash === setHash) return saved;
  return {
    setHash,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    phase: 'rating',
    index: 0,
    pairIndex: 0,
    ratings: {},
    pairs: {},
  };
}

export function saveProgress(p: Progress): void {
  write(`full:${p.setHash}`, p);
}

export function clearProgress(setHash: string): void {
  try {
    localStorage.removeItem(`${PREFIX}full:${setHash}`);
    localStorage.removeItem(`${PREFIX}pre-round:${setHash}`);
  } catch {
    // nothing saved
  }
}

export function loadPreRound(setHash: string): PreRoundProgress {
  const saved = read(`pre-round:${setHash}`) as PreRoundProgress | null;
  return saved?.setHash === setHash ? saved : { setHash, male: null, female: null };
}

export function savePreRound(p: PreRoundProgress): void {
  write(`pre-round:${p.setHash}`, p);
}

export function rating(p: Progress, code: string): Rating {
  const r = p.ratings[code] ?? {
    naturalness: null,
    wrong: null,
    note: '',
    heard: false,
    at: new Date().toISOString(),
  };
  p.ratings[code] = r;
  return r;
}
