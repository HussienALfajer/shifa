// Patient search (spec A-03 criteria 4–6, 21, 24; slice A-03-03; ADR-0052). One box: a file
// number, a previous number, a phone or its tail, a name however it was spelled. The term
// arrives in the body and is never logged, traced, audited or put in an error (criterion 6);
// search writes no `patient.chart_viewed` row (criterion 18). Before searching, a request writes
// a bounded number of the clinic's stale name keys (key version 0 or older), each batch in its
// own short transaction; a READ ONLY scope (a support session) skips that and searches the keys
// already written. Each search statement is capped by a transaction-local statement timeout.
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
import { sql } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { backfillNameKeys } from './name-keys.ts';
import { byName, bySimilarName, type NameHit, type NameHits } from './name-search.ts';
import {
  asciiDigits,
  byFileNumber,
  byPhone,
  byPhoneTail,
  byPreviousNumber,
  type ChartRow,
  displayNameOf,
} from './search.ts';

/** Searches a member may make per window (spec: a per-member rate limit). */
export const SEARCH_LIMIT = { max: 60, windowMs: 60_000 } as const;
/** Distinct name words looked up; more are ignored (a name has three parts). */
export const MAX_WORDS = 6;
/** Stale name keys written per request: BACKFILL_BATCHES transactions of BACKFILL_BATCH. */
const BACKFILL_BATCH = 200;
const BACKFILL_BATCHES = 3;
/** One search statement may take this long (ms) before PostgreSQL stops it. */
const STATEMENT_TIMEOUT_MS = 2000;
const SHOWN = 20;
/** The longest file number looked up (an int column). */
const FILE_NUMBER_DIGITS = 9;

/** The term as digits only, when it holds digits and phone punctuation and nothing else. */
function digitsOf(term: string): string | null {
  const compact = asciiDigits(term).replace(/[\s\u{00A0}().+-]/gu, '');
  return /^\d+$/.test(compact) ? compact : null;
}

/** The distinct key words a name search looks up: two characters or more, holding a letter. */
const nameWordsOf = (key: string) =>
  [...new Set(keyWords(key).filter((w) => /\p{L}/u.test(w) && Array.from(w).length >= 2))].slice(
    0,
    MAX_WORDS,
  );

/** Each word of `term` as typed is the start of a word of the display name. */
function typedAsStored(term: string, displayName: string): boolean {
  const stored = displayName.normalize('NFC').split(/\s+/u);
  return term
    .normalize('NFC')
    .split(/\s+/u)
    .filter((w) => /\p{L}/u.test(w))
    .every((w) => stored.some((s) => s.startsWith(w)));
}

/** Why a name hit matched (criterion 24): a typo or spelling, part order, or as stored. */
function nameKind(hit: NameHit, term: string): PatientMatchKind {
  if (hit.fuzzy) return 'name_variant';
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
    givenName: row.givenName,
    fatherName: row.fatherName,
    familyName: row.familyName,
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
  /** The term as digits, when it is only digits and phone punctuation. */
  readonly digits: string | null;
  readonly words: readonly string[];
  /**
   * The typed words keyed one by one (no particle join), when that differs: «آم الح» is the start
   * of «آمنة الحلبي», but keyed whole it joins «ام» (a particle) to the next word. Looked up only
   * when `words` find no chart.
   */
  readonly unjoined: readonly string[] | null;
  readonly states: readonly ChartRow['state'][];
}

/**
 * The term read (criterion 21): digits search numbers and phones; words of 2 letters or more
 * search names; any term holding a digit also looks up a previous number («123/2019»). A term
 * with none of these answers 400.
 */
export function parseSearch(input: PatientSearchRequest): SearchQuery {
  const term = input.term.trim();
  const key = normaliseName(term);
  const digits = digitsOf(term);
  const words = digits === null ? nameWordsOf(key) : [];
  if (digits === null && words.length === 0 && !/\p{Nd}/u.test(term)) throw tooShort();
  const states: ChartRow['state'][] =
    input.includeArchived === true ? ['active', 'archived'] : ['active'];
  const separate = nameWordsOf(
    term
      .split(/\s+/u)
      .map((w) => normaliseName(w))
      .join(' '),
  );
  const unjoined = words.length > 0 && separate.join(' ') !== words.join(' ') ? separate : null;
  return { term, key, digits, words, unjoined, states };
}

/** The name path: tokens, the words one by one, then the typo fallback. */
async function names(tx: Tx, q: SearchQuery): Promise<NameHits> {
  const found = await byName(tx, q.words, q.key, q.states);
  if (found.hits.length > 0) return found;
  if (q.unjoined) {
    const separate = await byName(tx, q.unjoined, q.key, q.states);
    if (separate.hits.length > 0) return separate;
  }
  return bySimilarName(tx, q.unjoined ?? q.words, q.key, q.states);
}

/** Every path's hits in answer order: numbers, phones, names (exported for the benchmark). */
export async function findHits(tx: Tx, q: SearchQuery): Promise<{ hits: Hit[]; capped: boolean }> {
  const hits: Hit[] = [];
  let capped = false;
  const add = (row: ChartRow, matchedBy: PatientMatchKind, more: Partial<Hit> = {}) =>
    hits.push({ row, matchedBy, matchedParts: [], mergedFileNumber: null, ...more });
  if (q.digits !== null && q.digits.length <= FILE_NUMBER_DIGITS) {
    const hit = await byFileNumber(tx, Number(q.digits), q.states);
    if (hit) add(hit.row, 'file_number', { mergedFileNumber: hit.mergedFileNumber });
  }
  if (/\p{Nd}/u.test(q.term)) {
    const previous = await byPreviousNumber(tx, q.term, q.states);
    if (previous) {
      add(previous.row, 'previous_file_number', { mergedFileNumber: previous.mergedFileNumber });
    }
  }
  if (q.digits !== null && q.digits.length >= 7) {
    const phone = normalisePhone(q.term);
    if (phone.ok) for (const row of await byPhone(tx, phone.e164, q.states)) add(row, 'phone');
    for (const row of await byPhoneTail(tx, q.digits, q.states)) add(row, 'phone_tail');
  }
  if (q.words.length > 0) {
    const found = await names(tx, q);
    capped = found.capped;
    for (const hit of found.hits) {
      add(hit.row, nameKind(hit, q.term), {
        matchedParts: [...new Set(hit.wordParts.flat())].sort((a, b) => a - b),
      });
    }
  }
  return { hits, capped };
}

@Injectable()
export class PatientSearchService {
  /** Searches per member in the current window (one process; ADR-0052). */
  readonly #windows = new Map<string, { start: number; count: number }>();

  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** `onLimited` is told (ids only) when the member is past the limit, before the 429. */
  async search(
    scope: RequestScope,
    input: PatientSearchRequest,
    onLimited: () => void,
  ): Promise<PatientSearchResults> {
    const query = parseSearch(input);
    if (!this.#count(scope)) {
      onLimited();
      throw new ApiError(429, 'rate_limited');
    }
    if (scope.readOnly !== true) {
      for (let i = 0; i < BACKFILL_BATCHES; i += 1) {
        const written = await this.tenants.run(scope, (tx) => backfillNameKeys(tx, BACKFILL_BATCH));
        if (written < BACKFILL_BATCH) break;
      }
    }
    return this.tenants.run(scope, async (tx) => {
      await tx.execute(
        sql`select set_config('statement_timeout', ${String(STATEMENT_TIMEOUT_MS)}, true)`,
      );
      return answer(await findHits(tx, query));
    });
  }

  /** False past SEARCH_LIMIT searches in a window, per member of a clinic. */
  #count(scope: RequestScope): boolean {
    const now = this.clock.now().getTime();
    const id = `${scope.tenantId}:${scope.userId}`;
    const window = this.#windows.get(id);
    if (!window || now - window.start >= SEARCH_LIMIT.windowMs) {
      if (this.#windows.size > 10_000) this.#prune(now);
      this.#windows.set(id, { start: now, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= SEARCH_LIMIT.max;
  }

  #prune(now: number): void {
    for (const [id, w] of this.#windows) {
      if (now - w.start >= SEARCH_LIMIT.windowMs) this.#windows.delete(id);
    }
  }
}

/** The first hit of each chart, in path order; at most 20, `truncated` when more matched. */
function answer({ hits, capped }: { hits: readonly Hit[]; capped: boolean }): PatientSearchResults {
  const seen = new Set<string>();
  const unique = hits.filter((h) => !seen.has(h.row.id) && seen.add(h.row.id));
  return {
    results: unique.slice(0, SHOWN).map(resultOf),
    truncated: capped || unique.length > SHOWN,
  };
}
