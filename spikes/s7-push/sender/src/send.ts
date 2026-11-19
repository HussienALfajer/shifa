// Send order (criteria 2, 3): inbox record → FCM call → send-log line. 429 and 5xx are retried
// with backoff up to 3 times under the same s7id; UNREGISTERED (or INVALID_ARGUMENT on the token)
// marks the install dead. The send log never holds the device token.
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type Kind, type Receiver, type StoredDevice } from '@shifa-spike/s7-receiver';
import { resolveTargets } from './devices.ts';
import { buildMessage, labelFor, textFor, validateLabel } from './payload.ts';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface SenderDeps {
  receiver: Receiver;
  fcmBaseUrl: string;
  projectId: string;
  getToken: () => Promise<string>;
  /** Directory of `sends.jsonl` (the receiver's `logs/`). */
  logDir: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  newId?: () => string;
}

export interface SendRequest {
  kind: Kind;
  appointmentId: string;
  appointmentAt: Date;
  /** An installId or `all`. */
  to: string;
  count?: number;
  collapse?: boolean;
  ttlTo?: Date;
}

export interface SendLogLine {
  s7id: string;
  installId: string;
  kind: Kind;
  label: string;
  appointmentId: string;
  collapse: boolean;
  ttl: string;
  sentAt: string;
  httpStatus: number | null;
  fcmName?: string;
  error?: string;
  attempts: number;
  durationMs: number;
}

interface FcmErrorBody {
  error?: {
    status?: string;
    details?: { errorCode?: string; fieldViolations?: { field?: string }[] }[];
  };
}

interface Outcome {
  status: number | null;
  name?: string;
  error?: string;
  dead: boolean;
  retry: boolean;
}

function classify(status: number, body: unknown): Outcome {
  if (status >= 200 && status < 300) {
    const name = (body as { name?: unknown } | null)?.name;
    return { status, name: typeof name === 'string' ? name : '', dead: false, retry: false };
  }
  const err = (body as FcmErrorBody | null)?.error;
  const code = err?.details?.find((d) => d.errorCode)?.errorCode;
  const fields = err?.details?.flatMap((d) => d.fieldViolations ?? []).map((v) => v.field) ?? [];
  const error = code ?? err?.status ?? `HTTP ${String(status)}`;
  const dead =
    code === 'UNREGISTERED' ||
    status === 404 ||
    (error === 'INVALID_ARGUMENT' && fields.includes('message.token'));
  return { status, error, dead, retry: status === 429 || status >= 500 };
}

export function createSender(deps: SenderDeps) {
  const now = deps.now ?? (() => new Date());
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const newId = deps.newId ?? (() => `s7-${randomUUID()}`);
  const url = `${deps.fcmBaseUrl}/v1/projects/${deps.projectId}/messages:send`;

  const post = async (body: unknown): Promise<Outcome> => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await deps.getToken()}`,
          'content-type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      });
      return classify(res.status, await res.json().catch(() => null));
    } catch {
      return { status: null, error: 'network', dead: false, retry: true };
    }
  };

  const sendOne = async (device: StoredDevice, req: SendRequest): Promise<SendLogLine> => {
    const s7id = newId();
    const sent = now();
    const label = labelFor(req.kind);
    const collapse = req.collapse ?? true;
    await deps.receiver.writeInbox({
      s7id,
      installId: device.installId,
      appointmentId: req.appointmentId,
      kind: req.kind,
      ...textFor(req.kind, req.appointmentAt),
      createdAt: sent.toISOString(),
    });
    const payload = buildMessage({
      kind: req.kind,
      appointmentId: req.appointmentId,
      appointmentAt: req.appointmentAt,
      token: device.token,
      s7id,
      now: sent,
      collapse,
      ...(req.ttlTo ? { ttlTo: req.ttlTo } : {}),
    });

    const started = Date.now();
    let attempts = 0;
    let outcome: Outcome;
    for (;;) {
      attempts += 1;
      outcome = await post(payload);
      if (!outcome.retry || attempts > MAX_RETRIES) break;
      await sleep(BASE_DELAY_MS * 2 ** (attempts - 1));
    }
    if (outcome.dead) await deps.receiver.markDead(device.installId, outcome.error ?? 'dead');

    const line: SendLogLine = {
      s7id,
      installId: device.installId,
      kind: req.kind,
      label,
      appointmentId: req.appointmentId,
      collapse: collapse && req.kind !== 'sync',
      ttl: payload.message.android.ttl,
      sentAt: sent.toISOString(),
      httpStatus: outcome.status,
      ...(outcome.name === undefined ? {} : { fcmName: outcome.name }),
      ...(outcome.error === undefined ? {} : { error: outcome.error }),
      attempts,
      durationMs: Date.now() - started,
    };
    await mkdir(deps.logDir, { recursive: true });
    await appendFile(join(deps.logDir, 'sends.jsonl'), `${JSON.stringify(line)}\n`, 'utf8');
    return line;
  };

  return {
    send: async (req: SendRequest): Promise<SendLogLine[]> => {
      if (!validateLabel(labelFor(req.kind))) throw new Error(`invalid label for ${req.kind}`);
      const lines: SendLogLine[] = [];
      for (const device of await resolveTargets(deps.receiver, req.to)) {
        for (let i = 0; i < (req.count ?? 1); i += 1) {
          const line = await sendOne(device, req);
          lines.push(line);
          if (await deps.receiver.isDead(device.installId)) break;
        }
      }
      return lines;
    },
  };
}

export type Sender = ReturnType<typeof createSender>;
