// The device side of reverse verification (criterion 9), played by a script instead of the
// Flutter app: request a nonce, hand the `wa.me` link to the patient (printed by the script; in
// tests the fake delivers the message), then poll with the device secret until verified,
// refused or expired. No websocket in the spike.

export interface DeviceOptions {
  baseUrl: string;
  deviceId: string;
  phone: string;
  pollMs: number;
  /** Gives up after this long (wall clock) with `refused: timeout`. */
  timeoutMs: number;
  /** Called once with the link and its prefilled text. */
  onLink: (link: string, text: string) => Promise<void> | void;
  sleep?: (ms: number) => Promise<void>;
}

export type DeviceResult =
  | { status: 'verified' }
  | { status: 'expired' }
  | { status: 'refused'; reason: string };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runDevice(options: DeviceOptions): Promise<DeviceResult> {
  const sleep = options.sleep ?? defaultSleep;
  const res = await fetch(`${options.baseUrl}/verify/nonce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: options.deviceId, phone: options.phone }),
  });
  const issued = (await res.json()) as Record<string, unknown>;
  if (res.status !== 201) {
    const error = issued['error'];
    return { status: 'refused', reason: typeof error === 'string' ? error : String(res.status) };
  }
  const nonceId = String(issued['nonceId']);
  const secret = String(issued['deviceSecret']);
  await options.onLink(String(issued['waLink']), String(issued['text']));
  const deadline = Date.now() + options.timeoutMs;
  while (Date.now() < deadline) {
    const poll = await fetch(`${options.baseUrl}/verify/${encodeURIComponent(nonceId)}`, {
      headers: { 'x-device-id': options.deviceId, 'x-device-secret': secret },
    });
    const body = (await poll.json()) as Record<string, unknown>;
    if (poll.status !== 200) return { status: 'refused', reason: String(body['error']) };
    if (body['status'] === 'verified') return { status: 'verified' };
    if (body['status'] === 'expired') return { status: 'expired' };
    if (body['lastFailure'] === 'rate_limited')
      return { status: 'refused', reason: 'rate_limited' };
    await sleep(options.pollMs);
  }
  return { status: 'refused', reason: 'timeout' };
}
