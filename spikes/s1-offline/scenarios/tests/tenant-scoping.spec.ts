// Criterion 10 on both engines: devices of tenants A and B sync; A's local store holds no B row;
// with PowerSync, the sync endpoint itself sends A nothing of B (the replication role bypasses
// RLS, so the stream filters are the boundary); a forged upload from A naming B's rows is refused.
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { syntheticIdentities } from '@shifa-spike/s1-server';
import { Device } from '../harness/device.ts';
import { toxi } from '../harness/toxi.ts';

const ids = syntheticIdentities();
const server = () => process.env['S1_SERVER_URL'] ?? '';

async function token(username: string): Promise<string> {
  const res = await fetch(`${server()}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  return ((await res.json()) as { token: string }).token;
}

const ticketIds = (d: Device) =>
  d.page
    .getByTestId('ticket-row')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-ticket') ?? ''));

/** Reads the PowerSync sync stream for a few seconds as `jwt` and returns the raw text. */
async function readStream(
  jwt: string,
  deviceId: string,
): Promise<{ status: number; text: string }> {
  const base = process.env['S1_POWERSYNC_URL'] ?? '';
  const abort = new AbortController();
  const res = await fetch(`${base}/sync/stream`, {
    method: 'POST',
    headers: { authorization: `Token ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      buckets: [],
      include_checksum: true,
      raw_data: true,
      parameters: { device_id: deviceId },
      streams: { include_defaults: true, subscriptions: [] },
    }),
    signal: abort.signal,
  });
  let text = '';
  const reader = res.body?.getReader();
  const until = Date.now() + 5_000;
  try {
    while (reader && Date.now() < until) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise<undefined>((resolve) => {
          setTimeout(() => {
            resolve(undefined);
          }, until - Date.now());
        }),
      ]);
      if (!chunk || chunk.done) break;
      text += new TextDecoder().decode(chunk.value);
    }
  } finally {
    abort.abort();
  }
  return { status: res.status, text };
}

test('a tenant A device never receives tenant B rows, and forged writes are refused', async ({
  browser,
}) => {
  await toxi.restore('dev-a');
  await toxi.restore('dev-b');
  const a = await Device.open(browser, 'dev-a');
  const b = await Device.open(browser, 'dev-b');
  await a.login('reception-a');
  await b.login('reception-b');
  await a.walkIn(1, false);
  await b.walkIn(1, false);
  await b.book('17:00', false);
  await a.waitSynced();
  await b.waitSynced();
  await a.waitSynced();

  const bTickets = await ticketIds(b);
  expect(bTickets.length).toBeGreaterThan(0);
  const aTickets = await ticketIds(a);
  expect(aTickets.length).toBeGreaterThan(0);
  for (const id of bTickets) expect(aTickets, 'A local store has no B ticket').not.toContain(id);
  const aText = (await a.page.locator('main').textContent()) ?? '';
  for (const id of bTickets) expect(aText).not.toContain(id);

  const tokenA = await token('reception-a');
  if (process.env['S1_ENGINE'] === 'powersync') {
    const stream = await readStream(tokenA, await a.deviceId());
    expect(stream.status).toBe(200);
    expect(stream.text.length, 'A receives its own data').toBeGreaterThan(0);
    expect(
      aTickets.some((id) => stream.text.includes(id)),
      'A sees its own ticket',
    ).toBe(true);
    for (const id of bTickets)
      expect(stream.text, 'the sync endpoint sends A nothing of B').not.toContain(id);
  }

  // A command forged from A's token with B's practitioner and ticket is refused, through either path.
  const forged = {
    id: randomUUID(),
    deviceId: 'forger',
    offline: true,
    clientTime: new Date().toISOString(),
    type: 'ticket.status',
    payload: { ticketId: bTickets[0], status: 'done' },
  };
  const issue = {
    ...forged,
    id: randomUUID(),
    type: 'ticket.issue',
    payload: {
      ticketId: randomUUID(),
      practitionerId: ids.B.practitioners[0]?.id,
      shiftDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date()),
      provisionalNumber: 1,
      walkInLabel: 'x',
    },
  };
  const viaCommands = await fetch(`${server()}/commands`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' },
    body: JSON.stringify({ commands: [forged, issue] }),
  });
  const results = ((await viaCommands.json()) as { results: { status: string }[] }).results;
  expect(results.map((r) => r.status)).toEqual(['refused', 'refused']);

  const viaUpload = await fetch(`${server()}/powersync/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      batch: [
        {
          op: 'PUT',
          type: 'outbox_command',
          id: randomUUID(),
          data: {
            type: 'ticket.status',
            payload: JSON.stringify(forged.payload),
            device_id: 'forger',
            offline: 1,
            client_time: forged.clientTime,
          },
        },
      ],
    }),
  });
  const uploaded = ((await viaUpload.json()) as { results: { status: string }[] }).results;
  expect(uploaded.map((r) => r.status)).toEqual(['refused']);
  // B's ticket is untouched.
  await b.waitSynced();
  await expect(
    b.page.locator(`[data-ticket="${bTickets[0] ?? ''}"] [data-testid=ticket-status]`),
  ).toHaveText('ينتظر');
});
