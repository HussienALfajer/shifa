// Health job (criterion 7, MSG-17), every 5 minutes in a worker (pg-boss cron); the suites call
// the handler directly. It reads each session's state from its WAHA container, maps it to
// linked | needs_qr | paused | down (alerting once per transition into needs_qr or down) and
// warns once when the phone has not been seen for 10 days. "Seen" is the last successful send
// or inbound message; whether GOWS gives a better signal is answered by 0.3-S5c.
import { type Ctx, loadSession } from './context.ts';
import { alert, markGatewayDown, setWahaStatus } from './fallback.ts';
import { wahaCall } from './waha.ts';

export const NOT_SEEN_MS = 10 * 24 * 60 * 60_000;

export async function runHealth(ctx: Ctx): Promise<void> {
  const resumed: string[] = [];
  for (const session of ctx.config.sessions) {
    const conf = ctx.config.containers[session.container];
    if (!conf) continue;
    const res = await wahaCall(
      conf,
      'GET',
      `/api/sessions/${encodeURIComponent(session.name)}`,
      undefined,
      ctx.config.sendTimeoutMs,
    );
    const status =
      res.kind === 'ok' && typeof res.json['status'] === 'string' ? res.json['status'] : null;
    await ctx.db.tx(async (client) => {
      const before = await loadSession(client, session.name, true);
      if (!before) return;
      if (status === null) {
        ctx.log('health_unreachable', { session: session.name, reason: res.kind });
        await markGatewayDown(ctx, client, session.name);
      } else {
        await setWahaStatus(ctx, client, session.name, status, true);
        if (status === 'WORKING' && (before.gateway_down || before.waha_status !== 'WORKING')) {
          resumed.push(session.name);
        }
      }
      const s = await loadSession(client, session.name, true);
      if (!s) return;
      const seen = Date.parse(s.last_ok_at ?? s.created_at);
      if (!s.not_seen_alerted && ctx.deps.now() - seen >= NOT_SEEN_MS) {
        await client.query('update s5.session set not_seen_alerted = true where name = $1', [
          s.name,
        ]);
        await alert(ctx, client, s.name, s.clinic_id, 'phone_not_seen');
      }
    });
  }
  for (const name of resumed) await ctx.kick(name);
}
