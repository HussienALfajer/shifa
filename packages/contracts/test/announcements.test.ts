// A-02-07 security review S1: the announcement body's link check sees through the look-alikes a
// browser or a reader would turn back into a link (full-width letters and dots, other dots,
// invisible characters, reversed text), names in any script before a top-level domain, and IPv4
// addresses; plain Arabic text with numbers, abbreviations and full stops passes.
import { describe, expect, it } from 'vitest';
import { hasAnnouncementLink } from '../src/announcements.ts';

describe('hasAnnouncementLink (security review S1)', () => {
  it('refuses links hidden by Unicode', () => {
    for (const body of [
      'shifa。com',
      'shifa．com',
      'shifa｡com',
      'shifa․com',
      'ｗｗｗ．ｅｘａｍｐｌｅ',
      'تحديث إلزامي لحسابكم: shifa-login­.com',
      'shifa​.com',
      'shifa⁠.com',
      '‮moc.nigol-afihs‬',
    ]) {
      expect(hasAnnouncementLink(body), JSON.stringify(body)).toBe(true);
    }
  });

  it('refuses any ASCII top-level domain, names in any script and IPv4 addresses', () => {
    for (const body of [
      'ادخلوا shifa-login.support',
      'clinic.health/login',
      'x.icu',
      'شفاء.com',
      'шифа.com',
      'موقع.سورية',
      '192.168.1.10/login',
      '192.168.1.10:8080/login',
    ]) {
      expect(hasAnnouncementLink(body), body).toBe(true);
    }
  });

  it('lets plain Arabic text through', () => {
    for (const body of [
      'سيتم التحديث.شكرا',
      'الإصدار 2.0 متاح',
      'الدوام من 9.30 حتى 2.15',
      'الطبيب د. أحمد متاح غدًا',
      'خصم 10% يوم 12/5',
    ]) {
      expect(hasAnnouncementLink(body), body).toBe(false);
    }
  });
});
