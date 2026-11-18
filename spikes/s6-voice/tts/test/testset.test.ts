// Criteria 3 and 4: the test set's shape and the public names list.
import { describe, expect, it } from 'vitest';
import { NAMES } from '../src/data.ts';
import { buildTestSet, DOCTOR_FIRST_NAMES, stripTashkeel, TASHKEEL_RE } from '../src/testset.ts';

describe('full test set', () => {
  const set = buildTestSet('full');
  const count = (category: string) => set.clips.filter((c) => c.category === category).length;

  it('has the planned category counts', () => {
    expect(count('chime')).toBe(1);
    expect(count('number')).toBe(50);
    expect(count('room')).toBe(5);
    expect(count('doctor')).toBe(2);
    expect(count('name')).toBe(100);
    expect(count('name-plain')).toBe(20);
    expect(set.announcements).toHaveLength(10);
    expect(set.clips).toHaveLength(178);
  });

  it('has unique clip ids and text for every clip but the chime', () => {
    const ids = set.clips.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const clip of set.clips) {
      if (clip.category === 'chime') expect(clip.text).toBe('');
      else expect(clip.text.length).toBeGreaterThan(0);
    }
  });

  it('builds each announcement from existing clips: chime, name, number, room', () => {
    const byId = new Map(set.clips.map((c) => [c.id, c]));
    const announcementIds = set.announcements.map((a) => a.id);
    expect(new Set(announcementIds).size).toBe(10);
    for (const a of set.announcements) {
      const categories = a.clipIds.map((id) => byId.get(id)?.category);
      expect(categories).toEqual(['chime', 'name', 'number', 'room']);
    }
  });

  it('writes numbers as words after "الرقم" and rooms in the recorded form', () => {
    for (const clip of set.clips.filter((c) => c.category === 'number')) {
      expect(clip.text).toMatch(/^الرقم [ء-ي ]+$/u);
    }
    const rooms = set.clips.filter((c) => c.category === 'room').map((c) => c.text);
    expect(rooms[0]).toBe('إلى العيادة رقم واحد');
    expect(rooms[4]).toBe('إلى العيادة رقم خمسة');
  });

  it('counts characters per set (code points of every text)', () => {
    const total = set.clips.reduce((sum, c) => sum + Array.from(c.text).length, 0);
    expect(set.characters).toBe(total);
    expect(set.characters).toBeGreaterThan(1000);
    expect(set.characters).toBeLessThan(10_000);
  });

  it('has a pre-round set of 5 phrases', () => {
    const pre = buildTestSet('pre-round');
    expect(pre.clips).toHaveLength(5);
    expect(pre.clips.every((c) => c.category === 'pre-round' && c.text.length > 0)).toBe(true);
    expect(pre.announcements).toHaveLength(0);
  });
});

describe('names.json', () => {
  it('has 100 entries, 50 male and 50 female, with unique ids and names', () => {
    expect(NAMES).toHaveLength(100);
    expect(NAMES.filter((n) => n.gender === 'male')).toHaveLength(50);
    expect(NAMES.filter((n) => n.gender === 'female')).toHaveLength(50);
    expect(new Set(NAMES.map((n) => n.id)).size).toBe(100);
    expect(new Set(NAMES.map((n) => n.plain)).size).toBe(100);
  });

  it('diacritises every name, and the diacritised form strips to the plain form', () => {
    for (const name of NAMES) {
      expect(name.diacritised, name.id).toMatch(TASHKEEL_RE);
      expect(name.plain, name.id).not.toMatch(TASHKEEL_RE);
      expect(stripTashkeel(name.diacritised), name.id).toBe(name.plain);
    }
  });

  it('flags 20 names for the undiacritised clip and cites a public source for every entry', () => {
    expect(NAMES.filter((n) => n.alsoPlain)).toHaveLength(20);
    for (const name of NAMES) expect(name.source, name.id).toMatch(/^https:\/\/\S+$/u);
  });

  it('includes Kurdish and Turkmen names and hard cases', () => {
    expect(NAMES.filter((n) => n.origin === 'kurdish').length).toBeGreaterThanOrEqual(10);
    expect(NAMES.filter((n) => n.origin === 'turkmen').length).toBeGreaterThanOrEqual(10);
    for (const tag of ['hamza', 'shadda', 'long-vowel', 'foreign'] as const) {
      expect(NAMES.filter((n) => n.hard.includes(tag)).length, tag).toBeGreaterThanOrEqual(5);
    }
  });

  it('never collides with the synthetic doctor names', () => {
    expect(DOCTOR_FIRST_NAMES).toHaveLength(2);
    for (const doctor of DOCTOR_FIRST_NAMES) {
      expect(NAMES.some((n) => n.plain === doctor)).toBe(false);
    }
  });
});
