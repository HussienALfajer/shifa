// The receiver's library API (criteria 1–3). The sender calls it in-process: `writeInbox` before
// every FCM call, `markDead` on UNREGISTERED. The HTTP server is a thin layer over the same calls.
import { createHash } from 'node:crypto';
import {
  type DeadRecord,
  type DeviceReport,
  type InboxRecord,
  inboxRecordSchema,
  type Receipt,
  type StoredDevice,
  type StoredReceipt,
} from './schemas.ts';
import { createStore, type JsonlStore } from './store.ts';

export interface Receiver {
  readonly store: JsonlStore;
  writeInbox: (record: InboxRecord) => Promise<void>;
  /** Records for one install, oldest first; `since` keeps those created strictly after it. */
  inbox: (installId: string, since?: string) => Promise<InboxRecord[]>;
  reportDevice: (report: DeviceReport) => Promise<void>;
  /** The latest report per install, in first-seen order. */
  devices: () => Promise<StoredDevice[]>;
  addReceipt: (receipt: Receipt) => Promise<void>;
  receipts: () => Promise<StoredReceipt[]>;
  /** `tokenHash` is the hash of the token FCM refused; default: the latest reported token. */
  markDead: (installId: string, reason: string, tokenHash?: string) => Promise<void>;
  /** Dead until the install reports a token other than the one FCM refused. */
  isDead: (installId: string) => Promise<boolean>;
}

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex').slice(0, 12);

export function openReceiver(dir: string, now: () => Date = () => new Date()): Receiver {
  const store = createStore(dir);

  const devices = async () => {
    const latest = new Map<string, StoredDevice>();
    for (const d of await store.readAll<StoredDevice>('devices')) latest.set(d.installId, d);
    return [...latest.values()];
  };

  return {
    store,
    writeInbox: async (record) => {
      await store.append('inbox', inboxRecordSchema.parse(record));
    },
    inbox: async (installId, since) => {
      const all = await store.readAll<InboxRecord>('inbox');
      const after = since === undefined ? undefined : Date.parse(since);
      return all.filter(
        (r) =>
          r.installId === installId && (after === undefined || Date.parse(r.createdAt) > after),
      );
    },
    reportDevice: async (report) => {
      const stored: StoredDevice = { ...report, reportedAt: now().toISOString() };
      await store.append('devices', stored);
    },
    devices,
    addReceipt: async (receipt) => {
      const stored: StoredReceipt = { ...receipt, storedAt: now().toISOString() };
      await store.append('receipts', stored);
    },
    receipts: () => store.readAll<StoredReceipt>('receipts'),
    markDead: async (installId, reason, tokenHash) => {
      const device = (await devices()).find((d) => d.installId === installId);
      const record: DeadRecord = {
        installId,
        tokenHash: tokenHash ?? (device ? hashToken(device.token) : null),
        reason,
        at: now().toISOString(),
      };
      await store.append('dead', record);
    },
    isDead: async (installId) => {
      const dead = (await store.readAll<DeadRecord>('dead')).filter(
        (r) => r.installId === installId,
      );
      if (dead.length === 0) return false;
      const device = (await devices()).find((d) => d.installId === installId);
      if (!device) return true;
      const current = hashToken(device.token);
      return dead.some((r) =>
        r.tokenHash === null
          ? Date.parse(r.at) > Date.parse(device.reportedAt)
          : r.tokenHash === current,
      );
    },
  };
}
