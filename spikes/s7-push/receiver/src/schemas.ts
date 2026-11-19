// Shapes the receiver accepts and stores (spike 0.3-S7). Synthetic data only: no names, no
// clinical fields; the FCM token is stored only in the device registry (state/), never in logs.
import { z } from 'zod';

const iso = z.iso.datetime({ offset: true });
const short = z.string().min(1).max(200);

export const KINDS = ['reminder', 'turn-near', 'call-in', 'sync'] as const;
export type Kind = (typeof KINDS)[number];

export const inboxRecordSchema = z.object({
  s7id: short,
  installId: short,
  appointmentId: short,
  kind: z.enum(KINDS),
  title: z.string().max(200),
  body: z.string().max(500),
  createdAt: iso,
});
export type InboxRecord = z.infer<typeof inboxRecordSchema>;

/** Channel importance as the probe reports it, or `missing` when the channel does not exist. */
const importance = z.enum(['none', 'min', 'low', 'default', 'high', 'max', 'missing', 'unknown']);

export const deviceReportSchema = z.object({
  installId: short,
  tokenHash: z.string().min(4).max(64),
  // FCM tokens are about 160 characters; allow headroom.
  token: z.string().min(1).max(4096),
  permission: z.enum(['granted', 'denied', 'notDetermined', 'provisional']),
  channels: z.object({ appointments: importance, general: importance }),
  appVersion: short,
  sdkInt: z.number().int().nonnegative(),
  model: short,
});
export type DeviceReport = z.infer<typeof deviceReportSchema>;
export type StoredDevice = DeviceReport & { reportedAt: string };

export const receiptSchema = z.object({
  installId: short,
  s7id: short,
  fcmMessageId: z.string().max(200).nullable().optional(),
  label: z.string().max(50),
  sentAt: iso,
  receivedAt: iso,
  clockOffsetMs: z.number().int().nullable().optional(),
  appState: z.enum(['foreground', 'background', 'terminated']),
  path: z.enum(['foreground', 'background', 'opened']),
});
export type Receipt = z.infer<typeof receiptSchema>;
export type StoredReceipt = Receipt & { storedAt: string };

export interface DeadRecord {
  installId: string;
  /** Hash of the token that FCM refused; null when no device report was known. */
  tokenHash: string | null;
  reason: string;
  at: string;
}

export interface RequestLogLine {
  at: string;
  method: string;
  /** Path without the query string. */
  path: string;
  status: number;
  ms: number;
}
