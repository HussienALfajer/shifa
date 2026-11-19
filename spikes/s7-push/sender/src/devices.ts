// Send targets from the receiver's device registry: one install by id, or every live install.
// A dead install (FCM said UNREGISTERED and no newer token came) is skipped or refused.
import { type Receiver, type StoredDevice } from '@shifa-spike/s7-receiver';

export async function resolveTargets(receiver: Receiver, to: string): Promise<StoredDevice[]> {
  const devices = await receiver.devices();
  if (to === 'all') {
    const live: StoredDevice[] = [];
    for (const d of devices) if (!(await receiver.isDead(d.installId))) live.push(d);
    return live;
  }
  const device = devices.find((d) => d.installId === to);
  if (!device) throw new Error(`unknown device ${to}: it has not reported to the receiver`);
  if (await receiver.isDead(to)) throw new Error(`refuses to send to dead device ${to}`);
  return [device];
}
