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

// Slice 0.3-S1e: a patient's token downloads only that patient's appointments and ticket, never
// another patient's of the same tenant or anything of tenant B (pull and, with PowerSync, stream).
test('a patient token downloads no other patient or tenant rows', async () => {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date());
  const seed = async (tenant: 'A' | 'B', patientId: string, hh: string) => {
    const t = ids[tenant];
    const practitionerId = t.practitioners.at(-1)?.id;
    const appointmentId = randomUUID();
    const ticketId = randomUUID();
    const envelope = () => ({
      id: randomUUID(),
      deviceId: 'patient-seed',
      offline: false,
      clientTime: new Date().toISOString(),
    });
    const res = await fetch(`${server()}/commands`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await token(t.receptionist.username)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        commands: [
          {
            ...envelope(),
            type: 'appointment.book',
            payload: {
              appointmentId,
              practitionerId,
              patientId,
              start: `${day}T${hh}:00:00+03:00`,
              end: `${day}T${hh}:30:00+03:00`,
            },
          },
          {
            ...envelope(),
            type: 'ticket.issue',
            payload: {
              ticketId,
              practitionerId,
              shiftDate: day,
              provisionalNumber: 1,
              walkInLabel: 'مراجع',
              patientId,
            },
          },
        ],
      }),
    });
    const { results } = (await res.json()) as { results: { status: string }[] };
    expect(results.map((r) => r.status)).toEqual(['applied', 'applied']);
    return [appointmentId, ticketId];
  };
  const [a1, a2] = ids.A.patients;
  const [b1] = ids.B.patients;
  const own = await seed('A', a1?.id ?? '', '05');
  const others = [
    ...(await seed('A', a2?.id ?? '', '06')),
    ...(await seed('B', b1?.id ?? '', '05')),
  ];

  const login = await fetch(`${server()}/auth/patient-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ patientId: a1?.id, deviceId: 'patient-a1' }),
  });
  const patientToken = ((await login.json()) as { token: string }).token;
  const pull = await fetch(`${server()}/sync/pull`, {
    headers: { authorization: `Bearer ${patientToken}` },
  });
  const pulled = JSON.stringify(await pull.json());
  for (const id of own) expect(pulled, 'the patient pulls their own rows').toContain(id);
  for (const id of others) expect(pulled, 'no other patient or tenant row').not.toContain(id);

  expect(pulled, 'a patient never sees which device issued a row').not.toContain('patient-seed');

  if (process.env['S1_ENGINE'] === 'powersync') {
    const stream = await readStream(patientToken, 'patient-a1');
    expect(stream.status).toBe(200);
    for (const id of own) expect(stream.text, 'the stream sends own rows').toContain(id);
    for (const id of others) expect(stream.text, 'the stream sends nothing else').not.toContain(id);

    // Login lets a client name any device id: naming the seeding (reception) device must not
    // stream that device's command results to a patient (security review M1).
    const spoof = await fetch(`${server()}/auth/patient-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patientId: a1?.id, deviceId: 'patient-seed' }),
    });
    const spoofToken = ((await spoof.json()) as { token: string }).token;
    const spoofed = await readStream(spoofToken, 'patient-seed');
    expect(spoofed.status).toBe(200);
    expect(spoofed.text, 'no command results of another principal').not.toContain(
      'offline_command',
    );
  }
});
