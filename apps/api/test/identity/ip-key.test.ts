// A-01-02 security review L3: the IP throttle counts IPv6 clients by their /64 and IPv4-mapped
// IPv6 as IPv4, so a host cannot spread attempts over its own addresses. Documentation ranges only.
import { describe, expect, it } from 'vitest';
import { ipKey } from '../../src/modules/identity/ip-key.ts';

describe('ipKey', () => {
  it.each([
    ['192.0.2.10', '192.0.2.10'],
    ['::ffff:192.0.2.10', '192.0.2.10'],
    ['::FFFF:c000:020a', '192.0.2.10'],
    ['2001:db8:1:2::1', '2001:0db8:0001:0002::/64'],
    ['2001:db8:1:2:ffff:ffff:ffff:ffff', '2001:0db8:0001:0002::/64'],
    ['2001:DB8:1:2:a:b:c:d', '2001:0db8:0001:0002::/64'],
    ['fe80::1%eth0', 'fe80:0000:0000:0000::/64'],
    ['::1', '0000:0000:0000:0000::/64'],
  ])('%s → %s', (address, key) => {
    expect(ipKey(address)).toBe(key);
  });

  it('two addresses in one /64 share a key; another /64 does not', () => {
    expect(ipKey('2001:db8:aa:bb::1')).toBe(ipKey('2001:db8:aa:bb:1234:5678:9abc:def0'));
    expect(ipKey('2001:db8:aa:bc::1')).not.toBe(ipKey('2001:db8:aa:bb::1'));
  });

  it('leaves anything else as it is', () => {
    expect(ipKey('unknown')).toBe('unknown');
  });
});
