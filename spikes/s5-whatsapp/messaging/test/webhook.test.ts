// Criterion 1 (webhook half): each WAHA container signs with its own HMAC key and posts to its
// own path; the service refuses anything else with no side effect, refuses a session that the
// posting container does not own, drops exact replays and applies opt-in state in message order.
import { describe, expect, it } from 'vitest';
import { newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();

const optinRows = (env: Awaited<ReturnType<typeof newEnv>>) =>
  env.query('select clinic_id, patient_id, opted_out from s5.optin');

describe('webhook integrity', () => {
  it('refuses unsigned, wrongly signed and other-container-signed webhooks with no side effect', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    const clinics = env.fakes.clinics;
    const platform = env.fakes.platform;
    if (!clinics || !platform) throw new Error('fakes');

    const unsigned = await clinics.inbound(
      'clinic-a',
      { from: p.chatId, body: 'hi' },
      { hmacKey: null },
    );
    expect(unsigned.status).toBe(401);
    const wrong = await clinics.inbound(
      'clinic-a',
      { from: p.chatId, body: 'hi' },
      { hmacKey: 'nope' },
    );
    expect(wrong.status).toBe(401);
    const otherKey = await clinics.inbound(
      'clinic-a',
      { from: p.chatId, body: 'hi' },
      { hmacKey: env.config.containers.platform?.hmacKey ?? '' },
    );
    expect(otherKey.status).toBe(401);
    // The platform container's own key on the clinics path is still the wrong key there.
    const crossPath = await platform.inbound(
      'clinic-a',
      { from: p.chatId, body: 'hi' },
      { url: clinics.webhookUrl() },
    );
    expect(crossPath.status).toBe(401);

    expect(await optinRows(env)).toEqual([]);
    expect(await env.query('select * from s5.webhook_seen')).toEqual([]);
  });

  it('refuses a session posted by a container that does not own it, and unknown sessions', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    const platform = env.fakes.platform;
    if (!platform) throw new Error('fakes');
    // Correctly signed by the platform container, but clinic-a lives in the clinics container.
    const res = await platform.inbound('clinic-a', { from: p.chatId, body: 'hi' });
    expect(res.status).toBe(403);
    const unknown = await platform.inbound('nobody', { from: p.chatId, body: 'hi' });
    expect(unknown.status).toBe(403);
    expect(await optinRows(env)).toEqual([]);
  });

  it('treats an exact replay as a no-op', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    const clinics = env.fakes.clinics;
    if (!clinics) throw new Error('fakes');
    await clinics.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    const stop = await clinics.inbound('clinic-a', { from: p.chatId, body: 'إيقاف' });
    expect(stop.status).toBe(200);
    const replay = await clinics.replay(stop.eventId);
    expect(replay.status).toBe(200);
    const confirmations = await env.query(
      "select id from s5.delivery_attempt where template_key = 'optout_confirmation'",
    );
    expect(confirmations).toHaveLength(1);
    expect(await env.query('select count(*)::int as n from s5.webhook_seen')).toEqual([{ n: 2 }]);
  });

  it('does not let an old inbound message that arrives after "إيقاف" opt the patient back in', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    const clinics = env.fakes.clinics;
    if (!clinics) throw new Error('fakes');
    await clinics.inbound('clinic-a', { from: p.chatId, body: 'أول رسالة' });
    env.clock.advance(60_000);
    clinics.holdWebhooks();
    const old = clinics.inbound('clinic-a', { from: p.chatId, body: 'رسالة قديمة' });
    env.clock.advance(5_000);
    const stop = clinics.inbound('clinic-a', { from: p.chatId, body: 'إيقاف' });
    await clinics.releaseWebhooks({ reverse: true });
    expect((await stop).status).toBe(200);
    expect((await old).status).toBe(200);
    expect(await optinRows(env)).toEqual([
      { clinic_id: 'c-a', patient_id: p.patientId, opted_out: true },
    ]);
  });
});
