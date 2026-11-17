// Fixture scrubber and check (criterion 11 preparation, criterion 2 fixtures, OD-23, ADR-0026).
// Raw captures (raw-capture.ts) hold real numbers and texts; the scrubber maps every number, LID,
// group, message key, push name and body to stable placeholders (one map per run, never written),
// recomputes the HMAC check per capture, writes one fixture per capture and deletes the raw file.
// The check fails on any run of 8+ digits that is not a synthetic number, in strings and keys,
// and in numeric values outside time fields.
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

const TEXT_KEYS = new Set(['body', 'text', 'caption', 'conversation', 'title', 'description']);
const NAME_KEYS = new Set(['pushName', 'notifyName', 'verifiedName', 'PushName', 'displayName']);
const TIME_KEY = /time|stamp|At$|cycle|ends|start|end|quota/i;
const TOKEN =
  /(\d+)(?::\d+)?@(c\.us|s\.whatsapp\.net|lid|g\.us|newsletter|broadcast)|(\+?)(\d{8,})/g;
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

  string(value: string): string {
    const id = MESSAGE_ID.exec(value);
    if (id?.[1] && id[2] && id[3]) return `${id[1]}_${this.tokens(id[2])}_${this.key(id[3])}`;
    if (/^evt_[0-9a-z]+$/.test(value)) {
      return this.map('event', value, (n) => `evt_${String(n).padStart(26, 'x')}`);
    }
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
        return `${plus}${this.digits('phone', run)}`;
      },
    );
  }

  value(key: string | undefined, value: unknown): unknown {
    if (typeof value === 'string') {
      if (key !== undefined && TEXT_KEYS.has(key)) {
        return value === '' ? '' : this.map('text', value, (n) => `text-${String(n)}`);
      }
      if (key !== undefined && NAME_KEYS.has(key)) {
        return this.map('name', value, (n) => `name-${String(n)}`);
      }
      return this.string(value);
    }
    if (Array.isArray(value)) return value.map((item) => this.value(key, item));
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [this.string(k), this.value(k, v)]),
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

function scan(value: unknown, key: string, path: string, out: string[]): void {
  const runs = (text: string, where: string) => {
    for (const m of text.matchAll(/\d{8,}/g)) {
      if (!isSyntheticDigits(m[0])) out.push(`${where}: ${String(m[0].length)}-digit run`);
    }
  };
  if (typeof value === 'string') runs(value, path);
  else if (typeof value === 'number') {
    if (!TIME_KEY.test(key)) runs(String(value), path);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      scan(item, key, `${path}[${String(i)}]`, out);
    });
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      runs(k, `${path} (key)`);
      scan(v, k, `${path}.${k}`, out);
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
