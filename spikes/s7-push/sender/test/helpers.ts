// Shared helpers for the sender suites: a throwaway receiver directory with seeded devices, and a
// fake service-account key generated per run (no key material is ever committed).
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openReceiver, type Receiver } from '@shifa-spike/s7-receiver';
import { type ServiceAccount } from '../src/auth.ts';

export function tempDir(prefix = 's7-sender-'): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    dir,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function receiverWithDevices(dir: string, installIds: string[]): Promise<Receiver> {
  const receiver = openReceiver(dir);
  for (const installId of installIds) {
    await receiver.reportDevice({
      installId,
      tokenHash: `hash-${installId}`,
      token: `token-${installId}`,
      permission: 'granted',
      channels: { appointments: 'high', general: 'default' },
      appVersion: '0.0.1',
      sdkInt: 34,
      model: 'sdk_gphone64_x86_64',
    });
  }
  return receiver;
}

export function fakeServiceAccount(tokenUrl: string): {
  account: ServiceAccount;
  publicKey: KeyObject;
} {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    publicKey,
    account: {
      type: 'service_account',
      project_id: 's7-fake',
      client_email: 'fcm-sender@s7-fake.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      token_uri: tokenUrl,
    },
  };
}
