// The address an IP throttle row counts (A-01-02 security review L3). An IPv6 host controls at
// least a /64 (2^64 addresses), so one per-address limit would never bind it: IPv6 addresses are
// counted by their /64, and IPv4-mapped IPv6 (`::ffff:192.0.2.1`) as the IPv4 address.
import { isIPv4, isIPv6 } from 'node:net';

/** The eight 16-bit groups of an IPv6 address, as 4-digit hex (undefined if not IPv6). */
function groupsOf(address: string): string[] | undefined {
  if (!isIPv6(address)) return undefined;
  const [head, tail] = address.split('::') as [string, string | undefined];
  const parts = (text: string) => (text === '' ? [] : text.split(':'));
  const left = parts(head);
  const right = tail === undefined ? [] : parts(tail);
  // An embedded IPv4 tail (a.b.c.d) is two groups.
  const expand = (list: string[]) =>
    list.flatMap((group) => {
      if (!isIPv4(group)) return [group];
      const [a = 0, b = 0, c = 0, d = 0] = group.split('.').map(Number);
      return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
    });
  const l = expand(left);
  const r = expand(right);
  const missing = 8 - l.length - r.length;
  const all = tail === undefined ? l : [...l, ...Array<string>(missing).fill('0'), ...r];
  return all.map((group) => group.toLowerCase().padStart(4, '0'));
}

export function ipKey(address: string): string {
  const zoneless = address.split('%')[0] ?? address;
  if (isIPv4(zoneless)) return zoneless;
  const groups = groupsOf(zoneless);
  if (groups?.length !== 8) return zoneless;
  // ::ffff:a.b.c.d → a.b.c.d
  if (groups.slice(0, 5).every((g) => g === '0000') && groups[5] === 'ffff') {
    const high = Number.parseInt(groups[6] ?? '0', 16);
    const low = Number.parseInt(groups[7] ?? '0', 16);
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
  }
  return `${groups.slice(0, 4).join(':')}::/64`;
}
