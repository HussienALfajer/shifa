// Patient search (spec A-03 criteria 4–6, 21, 24; slice A-03-03; ADR-0052). One box: a file
// number, a previous number, a phone or its tail, a name however it was spelled. The term
// arrives in the body and is never logged, traced, audited or put in an error (criterion 6);
// search writes no `patient.chart_viewed` row (criterion 18). A search first writes the name
// keys of charts saved before the tokens (key version 0) or under an older key version, unless
// the scope is READ ONLY (a support session), which searches the keys already written.
import { Inject, Injectable } from '@nestjs/common';
import {
  keyWords,
  normaliseName,
  normalisePhone,
  type PatientMatchKind,
  type PatientSearchRequest,
  type PatientSearchResult,
  type PatientSearchResults,
} from '@shifa/contracts';
import type { Tx } from '@shifa/db';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { backfillNameKeys } from './name-keys.ts';
import {
  byFileNumber,
  byName,
  byPhone,
  byPhoneTail,
  byPreviousNumber,
  type ChartRow,
  displayNameOf,
  type NameHit,
} from './search.ts';

/** Searches a member may make per window (spec: a per-member rate limit). */
export const SEARCH_LIMIT = { max: 60, windowMs: 60_000 } as const;
const SHOWN = 20;
/** The longest file number looked up (an int column). */
const FILE_NUMBER_DIGITS = 9;

/** Arabic-Indic and Persian digits as ASCII. */
const asciiDigits = (text: string) =>
  text.replace(/[\u{0660}-\u{0669}\u{06F0}-\u{06F9}]/gu, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });

/** The term as digits only, when it holds digits and phone punctuation and nothing else. */
function digitsOf(term: string): string | null {
  const compact = asciiDigits(term).replace(/[\s\u{00A0}().+-]/gu, '');
  return /^\d+$/.test(compact) ? compact : null;
}

/** The key's words a name search looks up: two characters or more, holding a letter. */
const nameWordsOf = (key: string) =>
  keyWords(key).filter((w) => /\p{L}/u.test(w) && Array.from(w).length >= 2);

/** Each word of `term` as typed is the start of a word of the display name. */
function typedAsStored(term: string, displayName: string): boolean {
  const stored = displayName.normalize('NFC').split(/\s+/u);
  return term
    .normalize('NFC')
    .split(/\s+/u)
    .filter((w) => /\p{L}/u.test(w))
    .every((w) => stored.some((s) => s.startsWith(w)));
}

/** Why a name hit matched (criterion 24): part order first, then spelling. */
function nameKind(hit: NameHit, term: string): PatientMatchKind {
  const firsts = hit.wordParts.map((parts) => Math.min(...parts));
  if (firsts.some((part, i) => i > 0 && part < (firsts[i - 1] ?? 0))) return 'name_order';
  return typedAsStored(term, displayNameOf(hit.row)) ? 'name' : 'name_variant';
}

export interface Hit {
  row: ChartRow;
  matchedBy: PatientMatchKind;
  matchedParts: number[];
  mergedFileNumber: number | null;
}

function resultOf(hit: Hit): PatientSearchResult {
  const { row } = hit;
  return {
    id: row.id,
    displayName: displayNameOf(row),
    fileNumber: row.fileNumber,
    sex: row.sex,
    birthDate: row.birthDate,
    birthDateEstimated: row.birthDateEstimated,
    contactPhone: row.contactPhone,
    state: row.state,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    matchedBy: hit.matchedBy,
    matchedParts: hit.matchedParts,
    mergedFileNumber: hit.mergedFileNumber,
  };
}

const tooShort = () => new RequestValidationError([{ path: 'body.term', code: 'too_small' }]);

/** A search as the paths read it. */
export interface SearchQuery {
  readonly term: string;
  readonly key: string;
  readonly digits: string | null;
  readonly words: readonly string[];
  readonly states: readonly ChartRow['state'][];
}

/** The term read (criterion 21): digits, or name words of 2 letters or more; else 400. */
export function parseSearch(input: PatientSearchRequest): SearchQuery {
  const term = input.term.trim();
  const key = normaliseName(term);
  const digits = digitsOf(term);
  const words = digits === null ? nameWordsOf(key) : [];
  if (digits === null && words.length === 0) throw tooShort();
  const states: ChartRow['state'][] =
    input.includeArchived === true ? ['active', 'archived'] : ['active'];
  return { term, key, digits, words, states };
}

/** Every path's hits in answer order: numbers, phones, names (exported for the benchmark). */
export async function findHits(tx: Tx, q: SearchQuery): Promise<Hit[]> {
  const hits: Hit[] = [];
  const add = (row: ChartRow, matchedBy: PatientMatchKind, more: Partial<Hit> = {}) =>
    hits.push({ row, matchedBy, matchedParts: [], mergedFileNumber: null, ...more });
  if (q.digits !== null && q.digits.length <= FILE_NUMBER_DIGITS) {
    const hit = await byFileNumber(tx, Number(q.digits), q.states);
    if (hit) add(hit.row, 'file_number', { mergedFileNumber: hit.mergedFileNumber });
  }
  const previous = await byPreviousNumber(tx, q.term, q.states);
  if (previous) {
    add(previous.row, 'previous_file_number', { mergedFileNumber: previous.mergedFileNumber });
  }
  if (q.digits !== null && q.digits.length >= 7) {
    const phone = normalisePhone(q.term);
    if (phone.ok) for (const row of await byPhone(tx, phone.e164, q.states)) add(row, 'phone');
    for (const row of await byPhoneTail(tx, q.digits, q.states)) add(row, 'phone_tail');
  }
  if (q.words.length > 0) {
    for (const hit of await byName(tx, q.words, q.key, q.states)) {
      add(hit.row, nameKind(hit, q.term), {
        matchedParts: [...new Set(hit.wordParts.flat())].sort((a, b) => a - b),
      });
    }
  }
  return hits;
}

@Injectable()
export class PatientSearchService {
  /** Searches per member in the current window (one process; ADR-0052). */
  readonly #windows = new Map<string, { start: number; count: number }>();

  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async search(scope: RequestScope, input: PatientSearchRequest): Promise<PatientSearchResults> {
    const query = parseSearch(input);
    this.#count(scope);
    return this.tenants.run(scope, async (tx) => {
      if (scope.readOnly !== true) await backfillNameKeys(tx);
      return answer(await findHits(tx, query));
    });
  }

  /** 429 `rate_limited` past SEARCH_LIMIT searches in a window, per member of a clinic. */
  #count(scope: RequestScope): void {
    const now = this.clock.now().getTime();
    const id = `${scope.tenantId}:${scope.userId}`;
    const window = this.#windows.get(id);
    if (!window || now - window.start >= SEARCH_LIMIT.windowMs) {
      if (this.#windows.size > 10_000) this.#prune(now);
      this.#windows.set(id, { start: now, count: 1 });
      return;
    }
    window.count += 1;
    if (window.count > SEARCH_LIMIT.max) throw new ApiError(429, 'rate_limited');
  }

  #prune(now: number): void {
    for (const [id, w] of this.#windows) {
      if (now - w.start >= SEARCH_LIMIT.windowMs) this.#windows.delete(id);
    }
  }
}

/** The first hit of each chart, in path order; at most 20, `truncated` when more matched. */
function answer(hits: readonly Hit[]): PatientSearchResults {
  const seen = new Set<string>();
  const unique = hits.filter((h) => !seen.has(h.row.id) && seen.add(h.row.id));
  return { results: unique.slice(0, SHOWN).map(resultOf), truncated: unique.length > SHOWN };
}
