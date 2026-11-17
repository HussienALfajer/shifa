// Review of 0.3-S5a (B2): a failed @lid lookup is not "unresolvable". The webhook is refused
// without being recorded, so WAHA's retry (here: a replay of the same event) still applies an
// opt-out.
import { describe, expect, it } from 'vitest';
import { newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();

describe('@lid lookup failure', () => {
  it('answers 503 and applies the opt-out when the event comes again', async () => {
    const env = track(await newEnv(pg.db));
    const fake = env.fakes.clinics;
    const p = await env.patient('c-a');
    const lid = '204011500700456@lid';
    fake?.registerLid('clinic-a', lid, p.chatId);
    await fake?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    env.clock.advance(1_000);

    fake?.setDown(true);
    const first = await fake?.inbound('clinic-a', { from: lid, body: 'إيقاف' });
    expect(first?.status).toBe(503);
    expect(await env.query('select opted_out from s5.optin')).toEqual([{ opted_out: false }]);

    fake?.setDown(false);
    const retry = await fake?.replay(first?.eventId ?? '');
    expect(retry?.status).toBe(200);
    expect(await env.query('select opted_out from s5.optin')).toEqual([{ opted_out: true }]);
  });
});
