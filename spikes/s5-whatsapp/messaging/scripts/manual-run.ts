// Manual run (criterion 11, OD-45): `node scripts/manual-run.ts serve` starts the service with the
// queue worker, raw webhook capture and the local admin page; `node scripts/manual-run.ts batch
// <count>` queues `count` reminders to P through the clinic session (the worker paces them: real
// gaps, cap per rolling hour, quiet hours). Settings come from the git-ignored `.env.local`; the
// steps are in docs/spikes/s5-manual-checklist.md.

import { readEnvLocal, runConfig } from '../src/env-local.ts';
import { createMessaging } from '../src/index.ts';
import { startAdminPage } from '../tools/admin-page.ts';

const [command, arg] = process.argv.slice(2);
const env = readEnvLocal();
const config = runConfig(env);

// P is the run's only patient; it must exist before P's first message, or the opt-in is dropped.
const P = { clinicId: 'c-run', patientId: 'p-owner', phone: env['S5_NUMBER_P'] ?? '' };

if (command === 'serve') {
  const messaging = await createMessaging(config);
  await messaging.registerPatient(P.clinicId, P.patientId, P.phone);
  const url = await messaging.listen(
    Number(env['S5_LISTEN_PORT'] ?? 3105),
    env['S5_LISTEN_HOST'] ?? '127.0.0.1',
  );
  const page = await startAdminPage(messaging, { port: Number(env['S5_ADMIN_PORT'] ?? 3106) });
  // Printed to this terminal only: the token opens the admin page.
  process.stdout.write(`service: ${url} (webhooks: /webhooks/platform, /webhooks/clinics)\n`);
  process.stdout.write(`admin page: ${page.url}/#t=${page.token}\n`);
  const stop = async () => {
    await page.close();
    await messaging.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
} else if (command === 'batch') {
  const count = Number(arg ?? 0);
  if (!Number.isInteger(count) || count < 1 || count > 60) throw new Error('batch <1..60>');
  // The batch only queues: no webhooks reach this process, so no raw capture either.
  const messaging = await createMessaging({ ...config, queue: 'producer', rawCaptureDir: '' });
  await messaging.registerPatient(P.clinicId, P.patientId, P.phone);
  const results: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const r = await messaging.sendWhatsApp(P.clinicId, P.patientId, 'appointment_reminder', {
      name: 'المالك',
      date: '2026-11-20',
      time: `${String(9 + (i % 8))}:30`,
    });
    const key = r.status === 'queued' ? 'queued' : `${r.status}:${r.reason}`;
    results[key] = (results[key] ?? 0) + 1;
  }
  process.stdout.write(`${JSON.stringify(results)}\n`);
  await messaging.close();
} else {
  process.stderr.write('usage: node scripts/manual-run.ts serve | batch <count>\n');
  process.exit(2);
}
