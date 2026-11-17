// Fixture scrubber and check (criterion 11 preparation, criterion 2 fixtures, OD-23, ADR-0026).
// Raw captures (raw-capture.ts) hold real numbers and texts. The scrubber works from an
// allow-list: only the structural fields the parsers read keep their shape (ids, chat ids,
// states, times), with every number, LID, group and message key mapped to a stable placeholder
// (one map per run, never written). Every other string becomes a `text-N` placeholder, other
// numbers become 0, and payload parts that carry content (`_data`, vCards, location, media,
// quoted messages) are dropped. It recomputes the HMAC check per capture, writes one fixture per
// capture and deletes the raw file. The check refuses any 8+ digit run that is not synthetic
// (spaces, dashes and Arabic-Indic digits included), any non-placeholder string outside the
// structural fields and any long number outside the named time fields.
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { RawCapture } from './raw-capture.ts';

/**
 * Synthetic numbers as `@shifa/testing` generates them: a real operator prefix, then the `00`
 * marker (Syria +9639X00XXXXX, Turkey +905XX00XXXXX). Copied, not imported: spike code.
 */
const SYNTHETIC = [/^\+9639[345689]00\d{5}$/, /^\+905\d{2}00\d{5}$/];
export const isSyntheticDigits = (digits: string) => SYNTHETIC.some((re) => re.test(`+${digits}`));

/** Arabic-Indic and Persian digits to ASCII (nothing else changes, so hex keys keep their case). */
const asciiDigits = (s: string) =>
  s.replace(/[٠-٩۰-۹]/g, (d) =>
    String(d.charCodeAt(0) - (d.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)),
  );

/** String fields the parsers read: kept, with their numbers and keys mapped. */
const STRUCTURAL = new Set([
  'id',
  'event',
  'session',
  'from',
  'to',
  'participant',
  'author',
  'chatId',
  'lid',
  'pn',
  'status',
  'ackName',
  'source',
  'engine',
  'version',
  'tier',
  'browser',
  'name',
  'enforcementType',
  'cappingStatus',
  'mvStatus',
  'oteStatus',
  'messageId',
  'editedMessageId',
  'revokedMessageId',
]);
/** Payload parts that carry content (contact cards, places, files, quotes, raw engine data). */
const DROPPED = new Set(['_data', 'vCards', 'location', 'media', 'replyTo', 'quotedMsg']);
/** Numeric fields that hold times, quotas or ack levels, never a number (exact names). */
const NUMERIC_KEY =
  /^(timestamp|t|messageTimestamp|cycleStart|cycleEnd|timeEnforcementEnds|totalQuota|usedQuota|ack|statusCode|[a-z]+At)$/;
const PLACEHOLDER = /^(text-\d+)?$/;
/** Fields the scrubber writes itself, outside the captured body. */
const FIXTURE_FIELDS = new Set(['container', 'receivedAt', 'algorithm']);
/** 8+ digits, also with spaces or dashes between them. */
const DIGIT_RUN = /\d(?:[ -]?\d){7,}/g;
/** ISO dates and times (`2026-11-17T10:00:00.000Z`): not numbers, removed before scanning. */
const ISO_TIME = /\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?/g;
const TOKEN =
  /(\d+)(?::\d+)?@(c\.us|s\.whatsapp\.net|lid|g\.us|newsletter|broadcast)|(\+?)(\d(?:[ -]?\d){7,})/g;
const MESSAGE_ID = /^(true|false)_(.+)_([0-9A-Za-z]{6,})$/;

/** Placeholder digit blocks: phone-like, all synthetic Syriatel numbers with the `00` marker. */
const BLOCK = { phone: '96393009', lid: '96393008', group: '96393007' } as const;

class Scrubber {
  private readonly maps = new Map<string, Map<string, string>>();

  private map(kind: string, value: string, make: (n: number) => string): string {
    let m = this.maps.get(kind);
    if (!m) {
      m = new Map();
      this.maps.set(kind, m);
    }
    const known = m.get(value);
    if (known !== undefined) return known;
    const made = make(m.size + 1);
    m.set(value, made);
    return made;
  }

  private digits(kind: keyof typeof BLOCK, digits: string) {
    return this.map(kind, digits, (n) => `${BLOCK[kind]}${String(n).padStart(4, '0')}`);
  }

  private key(value: string) {
    return this.map('key', value, (n) => {
      const tail = n.toString(16).toUpperCase().padStart(4, '0');
      return `${'ABCDEF'.repeat(8).slice(0, Math.max(2, value.length - 4))}${tail}`;
    });
  }

  /** A structural string: ids, chat ids, states. */
  structural(raw: string): string {
    const value = asciiDigits(raw);
    const id = MESSAGE_ID.exec(value);
    if (id?.[1] && id[2] && id[3]) return `${id[1]}_${this.tokens(id[2])}_${this.key(id[3])}`;
    if (/^evt_[0-9a-z]+$/.test(value)) {
      return this.map('event', value, (n) => `evt_${String(n).padStart(26, 'x')}`);
    }
    if (/^[0-9A-F]{12,}$/.test(value)) return this.key(value);
    return this.tokens(value);
  }

  private tokens(value: string): string {
    return value.replace(
      TOKEN,
      (_m, jid: string | undefined, kind: string | undefined, plus: string, run: string) => {
        if (jid !== undefined && kind !== undefined) {
          const k =
            kind === 'lid'
              ? 'lid'
              : kind === 'c.us' || kind === 's.whatsapp.net'
                ? 'phone'
                : 'group';
          return `${this.digits(k, jid)}@${kind}`;
        }
        return `${plus}${this.digits('phone', run.replace(/[ -]/g, ''))}`;
      },
    );
  }

  value(key: string | undefined, value: unknown): unknown {
    if (key !== undefined && DROPPED.has(key)) return null;
    if (typeof value === 'string') {
      if (key !== undefined && STRUCTURAL.has(key)) return this.structural(value);
      return value === '' ? '' : this.map('text', value, (n) => `text-${String(n)}`);
    }
    if (typeof value === 'number') return key !== undefined && NUMERIC_KEY.test(key) ? value : 0;
    if (Array.isArray(value)) return value.map((item) => this.value(key, item));
    if (typeof value === 'object' && value !== null) {
      // Keys are field names; one that holds a number or an id is mapped like a chat id.
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          /\d{6,}/.test(asciiDigits(k)) ? this.structural(k) : k,
          this.value(k, v),
        ]),
      );
    }
    return value;
  }
}

function signatureOf(capture: RawCapture, key: string | undefined) {
  const given = capture.headers['x-webhook-hmac'];
  if (typeof given !== 'string') return { present: false, valid: false };
  if (!key || !/^[0-9a-f]{128}$/i.test(given)) return { present: true, valid: false };
  const expected = createHmac('sha512', key).update(capture.body).digest();
  return { present: true, valid: timingSafeEqual(expected, Buffer.from(given, 'hex')) };
}

export interface ScrubOptions {
  rawDir: string;
  outDir: string;
  /** HMAC key per container, to recompute each capture's signature check. */
  hmacKeys: Record<string, string>;
}

export function scrubCaptures({ rawDir, outDir, hmacKeys }: ScrubOptions): { fixtures: string[] } {
  const scrubber = new Scrubber();
  mkdirSync(outDir, { recursive: true });
  const fixtures: string[] = [];
  const files = existsSync(rawDir) ? readdirSync(rawDir).filter((f) => f.endsWith('.json')) : [];
  for (const file of files.sort()) {
    const path = join(rawDir, file);
    const capture = JSON.parse(readFileSync(path, 'utf8')) as RawCapture;
    const signature = signatureOf(capture, hmacKeys[capture.container]);
    let body: unknown;
    try {
      body = scrubber.value(undefined, JSON.parse(capture.body));
    } catch {
      body = { unparseable: true };
    }
    const event =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { event?: unknown }).event === 'string'
        ? (body as { event: string }).event
        : 'unknown';
    const fixture = {
      container: capture.container,
      receivedAt: capture.receivedAt,
      signature: { ...signature, algorithm: capture.headers['x-webhook-hmac-algorithm'] ?? null },
      body,
    };
    const name = `${file.replace(/\.json$/, '')}-${event.replace(/[^a-z.]/g, '')}.json`;
    writeFileSync(join(outDir, name), `${JSON.stringify(fixture, null, 2)}\n`);
    unlinkSync(path);
    fixtures.push(name);
  }
  return { fixtures };
}

/** At most one problem per value; messages never contain the digits found. */
function scan(value: unknown, key: string, path: string, out: string[]): void {
  if (typeof value === 'string') {
    const run = [...asciiDigits(value).replace(ISO_TIME, ' ').matchAll(DIGIT_RUN)]
      .map((m) => m[0].replace(/[ -]/g, ''))
      .find((digits) => !isSyntheticDigits(digits));
    if (run) out.push(`${path}: ${String(run.length)}-digit run`);
    else if (!STRUCTURAL.has(key) && !FIXTURE_FIELDS.has(key) && !PLACEHOLDER.test(value)) {
      out.push(`${path}: text that is not a placeholder`);
    }
  } else if (typeof value === 'number') {
    if (!NUMERIC_KEY.test(key) && String(Math.abs(Math.trunc(value))).length >= 8) {
      out.push(`${path}: long number`);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      scan(item, key, `${path}[${String(i)}]`, out);
    });
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      // A key with digits is reported by position only, so the check never echoes a number.
      const digitsInKey = [...asciiDigits(k).matchAll(DIGIT_RUN)].map((m) =>
        m[0].replace(/[ -]/g, ''),
      );
      const segment = digitsInKey.length > 0 ? '[key]' : k;
      if (digitsInKey.some((d) => !isSyntheticDigits(d))) out.push(`${path}.[key]: digit run`);
      scan(v, k, `${path}.${segment}`, out);
    }
  }
}

/** Problems in the fixtures of a folder (empty when it passes or does not exist). */
export function checkFixtures(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const problems: string[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const found: string[] = [];
    scan(JSON.parse(readFileSync(join(dir, file), 'utf8')), '', '$', found);
    problems.push(...found.map((p) => `${file} ${p}`));
  }
  return problems;
}
