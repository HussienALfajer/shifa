// Flutter probe launcher (slice 0.3-S1e): starts the stack for one engine without the web
// prototype, seeds one synthetic patient's day through POST /commands (two appointments and a
// ticket, plus another patient's appointment and ticket that must never reach the device), runs
// `flutter test` in ../flutter_probe against it and always stops the stack.
//   ENGINE=outbox|powersync pnpm --filter @shifa-spike/s1-scenarios probe
// Prints counts only; never tokens, ids or row values.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syntheticIdentities } from '@shifa-spike/s1-server';
import { pinTestcontainersHelpers } from './images.ts';
import type { Engine } from './stack.ts';

pinTestcontainersHelpers();
const { startStack } = await import('./stack.ts');

const ENGINES = ['outbox', 'powersync', 'stub-plain', 'stub-drop'] as const;
const engine = (process.env['ENGINE'] ?? 'outbox') as (typeof ENGINES)[number];
if (!ENGINES.includes(engine)) throw new Error(`ENGINE must be one of ${ENGINES.join(', ')}`);
// The stubs (red proof) run against the outbox stack.
const stackEngine: Engine = engine === 'powersync' ? 'powersync' : 'outbox';

const DEVICE = 'probe-a';
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const PROBE = fileURLToPath(new URL('../../flutter_probe/', import.meta.url));
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date());
// Syria keeps UTC+3 all year.
const at = (time: string) => `${TODAY}T${time}:00+03:00`;

const out = (line: string) => process.stdout.write(`${line}\n`);

// Flutter's JSON reporter output (it may hold failure messages) is reduced to counts and deleted.
const SUMMARY = fileURLToPath(new URL('../test-results/summary/', import.meta.url));
const RAW = join(SUMMARY, `.probe-${engine}.raw.json`);
const started = Date.now();

interface ReporterEvent {
  type?: string;
  result?: string;
  hidden?: boolean;
  skipped?: boolean;
}

async function writeSummary(exitCode: number): Promise<void> {
  const counts = { passed: 0, failed: 0, skipped: 0 };
  try {
    for (const line of (await readFile(RAW, 'utf8')).split('\n')) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ReporterEvent;
      if (event.type !== 'testDone' || event.hidden === true) continue;
      if (event.skipped === true) counts.skipped += 1;
      else if (event.result === 'success') counts.passed += 1;
      else counts.failed += 1;
    }
  } finally {
    await rm(RAW, { force: true });
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  const body = { engine, at: new Date().toISOString(), exitCode, seconds, ...counts };
  await writeFile(
    join(SUMMARY, `${engine}-flutter-probe.json`),
    `${JSON.stringify(body, null, 2)}\n`,
  );
  out(`Probe summary: ${String(counts.passed)} passed, ${String(counts.failed)} failed.`);
}

async function post(url: string, path: string, body: unknown, token?: string): Promise<unknown> {
  const res = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`seed ${path}: ${String(res.status)}`);
  return res.json();
}

interface Seeded {
  patientId: string;
  otherAppointmentId: string;
  otherTicketId: string;
}

async function seed(url: string): Promise<Seeded> {
  const tenant = syntheticIdentities().A;
  const [patient, other] = tenant.patients;
  const practitioner = tenant.practitioners[0]?.id;
  if (!patient || !other || !practitioner) throw new Error('synthetic dataset changed');
  const { token } = (await post(url, '/auth/login', { username: 'reception-a' })) as {
    token: string;
  };
  const envelope = () => ({
    id: randomUUID(),
    deviceId: 'probe-seed',
    offline: false,
    clientTime: new Date().toISOString(),
  });
  const book = (patientId: string, start: string, end: string) => ({
    ...envelope(),
    type: 'appointment.book',
    payload: {
      appointmentId: randomUUID(),
      practitionerId: practitioner,
      patientId,
      start: at(start),
      end: at(end),
    },
  });
  const issue = (patientId: string, n: number) => ({
    ...envelope(),
    type: 'ticket.issue',
    payload: {
      ticketId: randomUUID(),
      practitionerId: practitioner,
      shiftDate: TODAY,
      provisionalNumber: n,
      walkInLabel: `مراجع تجريبي ${String(n)}`,
      patientId,
    },
  });
  const otherAppointment = book(other.id, '12:00', '12:30');
  const otherTicket = issue(other.id, 2);
  const commands = [
    book(patient.id, '10:00', '10:30'),
    book(patient.id, '11:00', '11:30'),
    issue(patient.id, 1),
    otherAppointment,
    otherTicket,
  ];
  const { results } = (await post(url, '/commands', { commands }, token)) as {
    results: { status: string }[];
  };
  const applied = results.filter((r) => r.status === 'applied').length;
  if (applied !== commands.length) throw new Error(`seed: ${String(applied)} applied`);
  out(`Seeded ${String(commands.length)} commands for the probe.`);
  return {
    patientId: patient.id,
    otherAppointmentId: otherAppointment.payload.appointmentId,
    otherTicketId: otherTicket.payload.ticketId,
  };
}

await mkdir(SUMMARY, { recursive: true });
const stack = await startStack(stackEngine, { prototype: false, devices: [DEVICE] });
let code: number;
try {
  const direct = stack.env['S1_SERVER_URL'] ?? '';
  const seeded = await seed(direct);
  const defines: Record<string, string> = {
    S1_ENGINE: engine,
    S1_SERVER_URL: stack.env['S1_URL_PROBE_A'] ?? '',
    S1_POWERSYNC_URL: stack.env['S1_PS_URL_PROBE_A'] ?? '',
    S1_TOXI_API: stack.env['S1_TOXI_API'] ?? '',
    S1_DIRECT_URL: direct,
    S1_PATIENT_ID: seeded.patientId,
    S1_OTHER_APPOINTMENT_ID: seeded.otherAppointmentId,
    S1_OTHER_TICKET_ID: seeded.otherTicketId,
    S1_DEVICE_ID: DEVICE,
    S1_PROXY: DEVICE,
  };
  const args = [
    `${ROOT}scripts/dart.mjs`,
    'flutter',
    'test',
    // The tests share one stack and one device: one file at a time.
    '--concurrency=1',
    `--file-reporter=json:${RAW}`,
    ...Object.entries(defines).map(([k, v]) => `--dart-define=${k}=${v}`),
    ...process.argv.slice(2),
  ];
  out(`Running the Flutter probe (${engine})...`);
  // Async: the spike server runs in this process and must keep answering during the tests.
  const child = spawn(process.execPath, args, { cwd: PROBE, stdio: 'inherit' });
  code = await new Promise<number>((resolve) => {
    child.on('exit', (status) => {
      resolve(status ?? 1);
    });
    child.on('error', () => {
      resolve(1);
    });
  });
  await writeSummary(code);
} finally {
  await stack.stop();
}
out(`Flutter probe (${engine}): exit ${String(code)}`);
process.exit(code);
