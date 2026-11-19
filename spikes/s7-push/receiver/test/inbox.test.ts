// Criterion 3: every send writes an inbox record first; the probe fetches it per installId.
import { afterEach, describe, expect, it } from 'vitest';
import { type InboxRecord, openReceiver, type ReceiverServer } from '../src/index.ts';
import { getJson, started, tempDir } from './helpers.ts';

const record = (s7id: string, installId: string, createdAt: string): InboxRecord => ({
  s7id,
  installId,
  appointmentId: 'appt-1',
  kind: 'reminder',
  title: 'تذكير بموعدك',
  body: 'موعدك في عيادة تجريبية',
  createdAt,
});

let server: ReceiverServer | undefined;
let cleanup: (() => void) | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
  cleanup?.();
});

describe('inbox', () => {
  it('returns a record written before a send for that installId only', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    server = await started(t.dir);
    await server.receiver.writeInbox(record('s7-a', 'install-1', '2026-11-19T08:00:00.000Z'));
    await server.receiver.writeInbox(record('s7-b', 'install-2', '2026-11-19T08:00:01.000Z'));

    const mine = (await getJson(`${server.url}/inbox?installId=install-1`)) as {
      items: InboxRecord[];
    };
    expect(mine.items.map((r) => r.s7id)).toEqual(['s7-a']);
    expect(mine.items[0]).toMatchObject({ title: 'تذكير بموعدك', kind: 'reminder' });

    const missing = await fetch(`${server.url}/inbox`);
    expect(missing.status).toBe(400);
  });

  it('filters by since (strictly after)', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    server = await started(t.dir);
    await server.receiver.writeInbox(record('s7-1', 'install-1', '2026-11-19T08:00:00.000Z'));
    await server.receiver.writeInbox(record('s7-2', 'install-1', '2026-11-19T08:05:00.000Z'));
    await server.receiver.writeInbox(record('s7-3', 'install-1', '2026-11-19T08:10:00.000Z'));

    const since = encodeURIComponent('2026-11-19T08:05:00.000Z');
    const res = (await getJson(`${server.url}/inbox?installId=install-1&since=${since}`)) as {
      items: InboxRecord[];
    };
    expect(res.items.map((r) => r.s7id)).toEqual(['s7-3']);
  });

  it('survives a restart (append-only files)', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    server = await started(t.dir);
    await server.receiver.writeInbox(record('s7-keep', 'install-1', '2026-11-19T08:00:00.000Z'));
    await server.close();

    server = await started(t.dir);
    const res = (await getJson(`${server.url}/inbox?installId=install-1`)) as {
      items: InboxRecord[];
    };
    expect(res.items.map((r) => r.s7id)).toEqual(['s7-keep']);

    // The library API the sender uses reads the same files without a server.
    const lib = openReceiver(t.dir);
    expect((await lib.inbox('install-1')).map((r) => r.s7id)).toEqual(['s7-keep']);
  });

  it('serves the clock and a synthetic queue line', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    server = await started(t.dir);
    const time = (await getJson(`${server.url}/time`)) as { now: number };
    expect(Math.abs(time.now - Date.now())).toBeLessThan(5_000);
    const queue = (await getJson(`${server.url}/queue?installId=install-1`)) as { text: string };
    expect(queue.text).toContain('دورك');
  });
});
