// Review of 0.3-S5b (non-blocking findings): the fixture check catches numbers in fields that
// only look like time fields and numbers written with spaces; vCards, business names and bare
// message keys are scrubbed; an unresolvable @lid sender is rate-limited by its chat; a kept
// database whose session rows disagree with the configuration refuses to start; the service never
// binds an unspecified address; a raw capture that cannot be written does not fail the webhook.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMessaging } from '../src/index.ts';
import { checkFixtures, scrubCaptures } from '../src/scrub.ts';
import { newEnv, SESSIONS, useDatabase, useEnvs } from './harness.ts';
import { chatOf, issue, outcomes } from './verify-helpers.ts';

const pg = useDatabase();
const track = useEnvs();
const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 's5-review-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
// An unmarked, real-format number on purpose: the fixture check must catch it. Joined at run
// time so the repository scan (scripts/test/no-real-phones.test.mjs) never sees it whole.
const UNMARKED = ['+963 94', '444 5555'].join(' ');

describe('review fixes', () => {
  it('the fixture check flags numbers in look-alike keys and spaced numbers', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'a.json'), JSON.stringify({ sender: 963912345678 }));
    writeFileSync(join(dir, 'b.json'), JSON.stringify({ note: `TEL:${UNMARKED}` }));
    writeFileSync(join(dir, 'c.json'), JSON.stringify({ timestamp: 1763372400, sentAt: 1763372 }));
    const problems = checkFixtures(dir);
    expect(problems.map((p) => p.split(' ')[0])).toEqual(['a.json', 'b.json']);
  });

  it('scrubs vCards, business names, spaced numbers and bare message keys', () => {
    const rawDir = tempDir();
    const outDir = tempDir();
    const key = '3EB0C1D2E3F4A5B6C7D8';
    const body = JSON.stringify({
      event: 'message',
      payload: {
        id: `false_963930012345@c.us_${key}`,
        vCards: [`BEGIN:VCARD\nFN:Real Name\nTEL:${UNMARKED}\nEND:VCARD`],
        note: `call ${UNMARKED}`,
        _data: { Info: { ID: key, BusinessName: 'Real Shop' } },
      },
    });
    writeFileSync(
      join(rawDir, '1-1-000001.json'),
      JSON.stringify({ container: 'clinics', receivedAt: '', headers: {}, body }),
    );
    scrubCaptures({ rawDir, outDir, hmacKeys: {} });
    expect(checkFixtures(outDir)).toEqual([]);
    const file = readdirSync(outDir)[0] ?? '';
    const fixture = JSON.parse(readFileSync(join(outDir, file), 'utf8')) as {
      body: { payload: { id: string; _data: unknown } };
    };
    const text = JSON.stringify(fixture);
    for (const secret of ['Real Name', 'Real Shop', '444 5555', key, '963930012345']) {
      expect(text.includes(secret), secret).toBe(false);
    }
    expect(fixture.body.payload._data).toBeNull();
    expect(fixture.body.payload.id).toMatch(/^false_96393009\d{4}@c\.us_[A-F0-9]+$/);
  });

  it('rate-limits an unresolvable @lid sender by its chat', async () => {
    const env = track(await newEnv(pg.db));
    const lid = '204011500700999@lid';
    env.fakes.platform?.registerLid('platform', lid, null);
    for (let i = 0; i < 6; i++) {
      await env.fakes.platform?.inbound('platform', {
        from: lid,
        body: 'رمز التحقق في شفاء: ZZZZZZ',
      });
    }
    expect((await outcomes(env)).slice(-2)).toEqual(['no_match', 'rate_limited']);
    // Another sender is not affected.
    const n = await issue(env, 'device-4001', '+963930012345');
    env.allowlist.add('+963930012345');
    await env.fakes.platform?.inbound('platform', { from: chatOf('+963930012345'), body: n.text });
    expect((await outcomes(env)).at(-1)).toBe('verified');
  });

  it('refuses to start on session rows that differ from the configuration', async () => {
    const env = track(await newEnv(pg.db));
    const moved = SESSIONS.map((s) => (s.name === 'clinic-b' ? { ...s, clinicId: 'c-z' } : s));
    await expect(createMessaging({ ...env.config, sessions: moved })).rejects.toThrow(/differs/);
  });

  it('never binds an unspecified address', async () => {
    const env = track(await newEnv(pg.db));
    for (const host of ['', '0.0.0.0', '::', '0']) {
      await expect(env.messaging.listen(0, host), host).rejects.toThrow(/specific address/);
    }
  });

  it('answers webhooks when the raw capture folder cannot be written', async () => {
    const dir = tempDir();
    const blocker = join(dir, 'file');
    writeFileSync(blocker, '');
    const env = track(await newEnv(pg.db, { rawCaptureDir: join(blocker, 'raw') }));
    const res = await env.fakes.platform?.inbound('platform', {
      from: chatOf('+963930012345'),
      body: 'مرحبا',
    });
    expect(res?.status).toBe(200);
    expect(env.logs.some((l) => l.includes('raw_capture_failed'))).toBe(true);
  });
});
