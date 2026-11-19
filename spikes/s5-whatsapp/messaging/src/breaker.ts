// Circuit breaker (criterion 6, MSG-16, OD-46): 463, 475 or a documented warning stop the
// session for 24 h; afterwards it stays paused until the clinic admin confirms resumption.
// Pending messages go to the fallback, the admin gets one alert per trip, and the session is
// never re-paired or restarted by the service.
import { type Ctx, loadSession, ts } from './context.ts';
import type { Client } from './db.ts';
import { alert, fallbackQueued, refreshHealth } from './fallback.ts';

export const PAUSE_MS = 24 * 60 * 60_000;

/**
 * Warning signals of the pinned WAHA (OpenAPI 2026.10.1): `messageCapping.cappingStatus`
 * FIRST_WARNING / SECOND_WARNING / CAPPED and an active `reachoutTimelock` (the restriction
 * behind 463). Unknown capping values are treated as a warning too (WAHA calls the set open),
 * except NONE. Lives in `normalise.ts` with the other webhook parsers.
 */
export { warningOf } from './normalise.ts';

export async function tripBreaker(ctx: Ctx, client: Client, name: string, reason: string) {
  const s = await loadSession(client, name, true);
  if (!s) return;
  const first = !s.needs_admin_resume;
  if (first) {
    await client.query(
      'update s5.session set needs_admin_resume = true, paused_until = $2 where name = $1',
      [name, ts(ctx, ctx.deps.now() + PAUSE_MS)],
    );
    await alert(ctx, client, name, s.clinic_id, 'breaker');
    ctx.log('breaker_tripped', { session: name, clinicId: s.clinic_id, reason });
  }
  await fallbackQueued(ctx, client, name, `breaker_${reason}`);
  await refreshHealth(ctx, client, name);
}

export type ResumeResult = 'resumed' | 'not_paused' | 'too_early' | 'unknown_session';

/** The clinic admin's confirmation, accepted only after the 24 h (OD-46). */
export async function resume(ctx: Ctx, name: string): Promise<ResumeResult> {
  const result = await ctx.db.tx(async (client): Promise<ResumeResult> => {
    const s = await loadSession(client, name, true);
    if (!s) return 'unknown_session';
    if (!s.needs_admin_resume) return 'not_paused';
    if (s.paused_until && Date.parse(s.paused_until) > ctx.deps.now()) return 'too_early';
    await client.query(
      'update s5.session set needs_admin_resume = false, paused_until = null where name = $1',
      [name],
    );
    await refreshHealth(ctx, client, name);
    ctx.log('breaker_resumed', { session: name, clinicId: s.clinic_id });
    return 'resumed';
  });
  if (result === 'resumed') await ctx.kick(name);
  return result;
}
