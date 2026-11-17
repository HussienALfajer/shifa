// WAHA container configuration for the pinned release (env names checked against the pinned
// image's docs and entrypoint, 2026-11-17):
// - GOWS engine (the `gows-` build sets it; repeated here so the test sees it);
// - PostgreSQL session storage (`WHATSAPP_SESSIONS_POSTGRESQL_URL`): WAHA creates its own
//   database `waha_<WAHA_NAMESPACE>` with the role it connects as, so each container gets its
//   own namespace and its own role with CREATEDB;
// - API key (`WAHA_API_KEY`, hashed to sha512 by the image's entrypoint before WAHA starts);
// - hardening: QR printing, dashboard and Swagger off, log level warn, JSON logs. The image
//   prints generated dashboard and Swagger passwords on start when none are set, so per-run
//   values are passed (both stay disabled);
// - global webhook with the six events the spike uses, HMAC key per container. WAHA signs the
//   raw body with HMAC-SHA512 (`X-Webhook-Hmac`, `X-Webhook-Hmac-Algorithm: sha512`); the
//   timestamp header is not covered, hence dedupe and ordering in the service.
import { randomBytes } from 'node:crypto';
import type { ContainerSpec } from './containers.ts';
import { IMAGES } from './images.ts';

export const WEBHOOK_EVENTS = [
  'message',
  'message.ack',
  'message.edited',
  'message.revoked',
  'message.reaction',
  'session.status',
] as const;

export interface WahaHandle {
  /** Logical container name: `platform` or `clinics` (MSG-09, MSG-10). */
  name: string;
  container: string;
  /** Base URL on the `messaging` network. */
  url: string;
  apiKey: string;
  hmacKey: string;
  namespace: string;
  dbRole: string;
  dbPassword: string;
}

export const secret = () => randomBytes(24).toString('base64url');

export function newWahaHandle(runId: string, name: string): WahaHandle {
  const container = `${runId}-waha-${name}`;
  return {
    name,
    container,
    url: `http://waha-${name}:3000`,
    apiKey: secret(),
    hmacKey: secret(),
    namespace: name,
    dbRole: `waha_${name}`,
    dbPassword: secret(),
  };
}

export function wahaSpec(
  runId: string,
  waha: WahaHandle,
  network: string,
  pgHost: string,
  webhookBase: string,
): ContainerSpec {
  const storage = `postgres://${waha.dbRole}:${waha.dbPassword}@${pgHost}:5432/postgres?sslmode=disable`;
  return {
    name: waha.container,
    image: IMAGES.waha,
    runId,
    networks: [{ network, aliases: [`waha-${waha.name}`] }],
    env: {
      WHATSAPP_DEFAULT_ENGINE: 'GOWS',
      WAHA_PRINT_QR: 'False',
      WAHA_DASHBOARD_ENABLED: 'False',
      WHATSAPP_SWAGGER_ENABLED: 'False',
      WAHA_LOG_LEVEL: 'warn',
      WAHA_LOG_FORMAT: 'JSON',
      WAHA_NAMESPACE: waha.namespace,
      WAHA_SESSION_NAMESPACE: waha.namespace,
      WHATSAPP_HOOK_URL: `${webhookBase}/webhooks/${waha.name}`,
      WHATSAPP_HOOK_EVENTS: WEBHOOK_EVENTS.join(','),
      WHATSAPP_HOOK_RETRIES_POLICY: 'linear',
      WHATSAPP_HOOK_RETRIES_DELAY_SECONDS: '2',
      WHATSAPP_HOOK_RETRIES_ATTEMPTS: '4',
    },
    secretEnv: {
      WAHA_API_KEY: waha.apiKey,
      WHATSAPP_HOOK_HMAC_KEY: waha.hmacKey,
      WHATSAPP_SESSIONS_POSTGRESQL_URL: storage,
      WAHA_DASHBOARD_USERNAME: secret(),
      WAHA_DASHBOARD_PASSWORD: secret(),
      WHATSAPP_SWAGGER_USERNAME: secret(),
      WHATSAPP_SWAGGER_PASSWORD: secret(),
    },
  };
}
