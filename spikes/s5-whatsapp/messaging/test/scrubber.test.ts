// Criterion 11 (preparation, OD-23, ADR-0026): during the manual run raw webhook bodies go only to
// a git-ignored capture folder; the scrubber maps every number, LID, JID, message id, push name
// and body to stable placeholders, keeps a recomputed signature result per fixture, writes the
// fixtures and deletes the raw files; the fixture check fails on any digit run of 8 or more that
// is not a synthetic number.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkFixtures, scrubCaptures } from '../src/scrub.ts';
import { newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 's5-scrub-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const phoneA = '+963930012345';
const phoneB = '+963940054321';
const lid = '204011500700888@lid';
const BODY = 'رسالة سرية من المريض ٤٢';

describe('raw capture and scrubber', () => {
  it('scrubs a capture to consistent placeholders, keeps the signature result, deletes raw files', async () => {
    const rawDir = tempDir();
    const outDir = tempDir();
    const env = track(await newEnv(pg.db, { rawCaptureDir: rawDir }));
    env.allowlist.add(phoneA);
    const clinics = env.fakes.clinics;
    const platform = env.fakes.platform;
    clinics?.registerLid('clinic-a', lid, `${phoneA.slice(1)}@c.us`);
    await clinics?.inbound('clinic-a', { from: `${phoneA.slice(1)}@c.us`, body: BODY });
    await clinics?.inbound('clinic-a', { from: lid, body: 'مرحبا' });
    await clinics?.inbound('clinic-a', { from: `${phoneB.slice(1)}@c.us`, body: BODY });
    await clinics?.inbound(
      'clinic-a',
      { from: `${phoneB.slice(1)}@c.us`, body: 'x' },
      { hmacKey: 'forged-key-forged-key' },
    );
    await platform?.inbound('platform', { from: `${phoneA.slice(1)}@c.us`, body: BODY });
    await clinics?.status('clinic-a', 'FAILED');

    const raws = readdirSync(rawDir);
    expect(raws.length).toBe(6);
    // Raw files hold the real bodies (that is why they never leave the git-ignored folder).
    expect(raws.map((f) => readFileSync(join(rawDir, f), 'utf8')).join('\n')).toContain(
      phoneA.slice(1),
    );

    const hmacKeys = Object.fromEntries(
      Object.entries(env.config.containers).map(([name, c]) => [name, c.hmacKey]),
    );
    const { fixtures } = scrubCaptures({ rawDir, outDir, hmacKeys });
    expect(fixtures).toHaveLength(6);
    expect(readdirSync(rawDir)).toEqual([]);

    const files = readdirSync(outDir).sort();
    const text = files.map((f) => readFileSync(join(outDir, f), 'utf8')).join('\n');
    for (const secret of [
      phoneA.slice(1),
      phoneB.slice(1),
      lid.split('@')[0] ?? lid,
      BODY,
      'مرحبا',
      '963990000001',
      ...Object.values(hmacKeys),
    ]) {
      expect(text.includes(secret), secret.slice(0, 4)).toBe(false);
    }
    expect(checkFixtures(outDir)).toEqual([]);

    const parsed = files.map(
      (f) =>
        JSON.parse(readFileSync(join(outDir, f), 'utf8')) as {
          container: string;
          signature: { present: boolean; valid: boolean };
          body: { event: string; payload: Record<string, unknown> };
        },
    );
    const messages = parsed.filter((p) => p.body.event === 'message');
    expect(messages).toHaveLength(5);
    // Signature results: one forged among the messages, the rest valid.
    expect(parsed.filter((p) => !p.signature.valid)).toHaveLength(1);
    expect(parsed.every((p) => p.signature.present)).toBe(true);
    // The same number maps to the same placeholder across files and inside message ids.
    const fromA = messages.find((m) => m.container === 'clinics')?.body.payload;
    const fromAOnPlatform = messages.find((m) => m.container === 'platform')?.body.payload;
    expect(fromA?.['from']).toBe(fromAOnPlatform?.['from']);
    expect(String(fromA?.['from'])).toMatch(/^\d+@c\.us$/);
    expect(String(fromA?.['id']).startsWith(`false_${String(fromA?.['from'])}_`)).toBe(true);
    // The same body maps to the same placeholder; different bodies differ.
    const bodies = messages.map((m) => String(m.body.payload['body']));
    expect(bodies.filter((b) => b === bodies[0]).length).toBeGreaterThanOrEqual(2);
    expect(new Set(bodies).size).toBeGreaterThan(1);
    // LIDs keep their kind.
    expect(text).toMatch(/\d+@lid/);
  });

  it('the fixture check fails on an injected real-looking number and passes on synthetic ones', () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, 'ok.json'),
      JSON.stringify({ body: { payload: { from: '963930012345@c.us', timestamp: 1763372400 } } }),
    );
    expect(checkFixtures(dir)).toEqual([]);
    writeFileSync(
      join(dir, 'bad.json'),
      JSON.stringify({ body: { payload: { note: 'call +963991234567 later' } } }),
    );
    const problems = checkFixtures(dir);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('bad.json');
    expect(problems[0]).not.toContain('991234567');
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ x: '204011500700888@lid' }));
    expect(checkFixtures(dir)).toHaveLength(1);
  });

  it('the committed fixtures pass the check', () => {
    expect(checkFixtures(join(import.meta.dirname, '..', '..', 'fixtures'))).toEqual([]);
  });
});
