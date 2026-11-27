// Announcements (A-02 criteria 16, 22, 23; OD-115, PLT-18; slice A-02-07): plain-text banners the
// super admin posts to every clinic or to selected ones, with a level, a start and an optional
// end. Every member of a targeted clinic sees the active ones until they dismiss each; a dismissal
// holds for the version the person hid (a new body or level is a new version). Phishing is the
// risk (spec "Money, abuse and privacy"): the body is plain text, and a link, a domain, an e-mail
// or markup is refused with 400 `announcement_link`.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';

export const ANNOUNCEMENT_BODY_MAX = 280;

export const AnnouncementLevel = z.enum(['info', 'warning']).meta({ id: 'AnnouncementLevel' });
export type AnnouncementLevel = z.infer<typeof AnnouncementLevel>;

/** By the time of the read: before its start, between start and end, after its end. */
export const AnnouncementStatus = z
  .enum(['scheduled', 'active', 'ended'])
  .meta({ id: 'AnnouncementStatus' });
export type AnnouncementStatus = z.infer<typeof AnnouncementStatus>;

export const AnnouncementTarget = z.enum(['all', 'selected']).meta({ id: 'AnnouncementTarget' });
export type AnnouncementTarget = z.infer<typeof AnnouncementTarget>;

// What a link in a banner looks like (spec "Money, abuse and privacy": phishing). The body is
// matched as a copy: NFKC (full-width letters and dots fold to ASCII), dot look-alikes turned into
// a dot, invisible characters (soft hyphen, zero-width space, word joiner) removed; the stored text
// stays as typed. Refused: a bidirectional embedding or override (text shown reversed), a scheme,
// `www.`, an e-mail, a host (a name in any script, a dot, then an ASCII top-level domain or an
// Arabic country one: `example.com`, `t.me`, `shifa-login.support`, `شفاء.com`, `موقع.سورية`),
// an IPv4 address, and markup (a tag or an entity). Not a link: a decimal number (`9.30`), an
// abbreviation before a space (`د. أحمد`), Arabic sentences joined by a full stop
// (`التحديث.شكرا`). Spaced or spelled-out dots (`shifa . com`) are out of reach of any list.
const DOT_LOOKALIKES = /[\u2024\u3002\uFE52\uFF0E\uFF61\u0701\u0702\u06D4]/gu;
const INVISIBLE = /\p{Default_Ignorable_Code_Point}/gu;
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/u;
const ARABIC_TLDS =
  'سورية|سوريا|السعودية|امارات|مصر|عمان|قطر|الاردن|الجزائر|المغرب|تونس|السودان|فلسطين|عراق|البحرين|اليمن|موريتانيا';
const LINK_PATTERNS: readonly RegExp[] = [
  /[a-z][a-z0-9+.-]*:\/\//iu,
  /\bwww\./iu,
  /[^\s@]+@[^\s@]+\.[^\s@]+/u,
  new RegExp(
    String.raw`[\p{L}\p{N}-]*\p{L}[\p{L}\p{N}-]*(?:\.[\p{L}\p{N}-]+)*\.(?:[a-z]{2,63}|${ARABIC_TLDS})(?![\p{L}\p{N}])`,
    'iu',
  ),
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/u,
  /<\s*[a-z!/?]/iu,
  /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/iu,
];

/**
 * True when the body holds a bidirectional override, a URL, `www.`, a host or address, an e-mail
 * address or markup.
 */
export function hasAnnouncementLink(body: string): boolean {
  if (BIDI_CONTROLS.test(body)) return true;
  const text = body.normalize('NFKC').replace(DOT_LOOKALIKES, '.').replace(INVISIBLE, '');
  return LINK_PATTERNS.some((pattern) => pattern.test(text));
}

/** 1 to 280 characters once trimmed (400 `validation_failed` on body.body). */
const AnnouncementBody = z.string().trim().min(1).max(ANNOUNCEMENT_BODY_MAX);

export const AnnouncementClinic = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: 'AnnouncementClinic' });

export const Announcement = z
  .object({
    id: z.uuid(),
    /** 1 at creation, one more at each change of the body or the level (criterion 16). */
    version: z.int().min(1),
    body: z.string(),
    level: AnnouncementLevel,
    startsAt: z.iso.datetime(),
    /** Null: until it is ended. Set to the moment it was ended early or cancelled. */
    endsAt: z.iso.datetime().nullable(),
    status: AnnouncementStatus,
    /** Ended (or cancelled) by a super admin before its own end. */
    endedEarly: z.boolean(),
    endedByName: z.string().nullable(),
    target: AnnouncementTarget,
    /** The selected clinics by name; empty when the target is every clinic. */
    clinics: z.array(AnnouncementClinic),
    createdByName: z.string().nullable(),
    createdAt: z.iso.datetime(),
    /** Targeted members who hid this version (criterion 22); null while scheduled. */
    dismissedCount: z.int().min(0).nullable(),
    /** Non-deactivated members of its clinics, counted at the read; null while scheduled. */
    targetedMembers: z.int().min(0).nullable(),
  })
  .meta({ id: 'Announcement' });
export type Announcement = z.infer<typeof Announcement>;

export const AnnouncementCounts = z
  .object({
    scheduled: z.int().min(0),
    active: z.int().min(0),
    ended: z.int().min(0),
  })
  .meta({ id: 'AnnouncementCounts' });

export const AnnouncementList = z
  .object({
    /** Every announcement by status, whatever `status` filters (SegmentedControl counts). */
    counts: AnnouncementCounts,
    /** Newest first. */
    announcements: z.array(Announcement),
  })
  .meta({ id: 'AnnouncementList' });
export type AnnouncementList = z.infer<typeof AnnouncementList>;

export const AnnouncementListQuery = z
  .object({ status: AnnouncementStatus.optional() })
  .meta({ id: 'AnnouncementListQuery' });

export const AnnouncementIdParams = z.object({ id: z.uuid() }).meta({ id: 'AnnouncementIdParams' });

/**
 * A new announcement. `endsAt` after `startsAt` and not past, `clinicIds` (existing clinics) only
 * and always with `selected`: 400 on body.endsAt or body.clinicIds (`custom`, `invalid_value`).
 */
export const CreateAnnouncementRequest = z
  .object({
    body: AnnouncementBody,
    level: AnnouncementLevel,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().nullable().optional(),
    target: AnnouncementTarget,
    clinicIds: z.array(z.uuid()).max(1000).optional(),
  })
  .meta({ id: 'CreateAnnouncementRequest' });
export type CreateAnnouncementRequest = z.infer<typeof CreateAnnouncementRequest>;

/** The same fields, each optional; the result is checked as a new one would be. */
export const UpdateAnnouncementRequest = z
  .object({
    body: AnnouncementBody.optional(),
    level: AnnouncementLevel.optional(),
    startsAt: z.iso.datetime().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    target: AnnouncementTarget.optional(),
    clinicIds: z.array(z.uuid()).max(1000).optional(),
  })
  .meta({ id: 'UpdateAnnouncementRequest' });
export type UpdateAnnouncementRequest = z.infer<typeof UpdateAnnouncementRequest>;

/** An announcement as a member's banner shows it (PageBanner). */
export const MyAnnouncement = z
  .object({
    id: z.uuid(),
    version: z.int().min(1),
    level: AnnouncementLevel,
    body: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'MyAnnouncement' });
export type MyAnnouncement = z.infer<typeof MyAnnouncement>;

export const MyAnnouncements = z
  .object({
    /** Active for this clinic and not hidden by this person: warnings first, then newest. */
    announcements: z.array(MyAnnouncement),
  })
  .meta({ id: 'MyAnnouncements' });
export type MyAnnouncements = z.infer<typeof MyAnnouncements>;

export const DismissAnnouncementRequest = z
  .object({ version: z.int().min(1) })
  .meta({ id: 'DismissAnnouncementRequest' });

// 409 `announcement_ended`: an edit or end of an ended announcement (reload: it is in «المنتهية»).

export const platformAnnouncements = defineContract({
  operationId: 'platformAnnouncements',
  method: 'GET',
  path: '/platform/announcements',
  summary: 'Announcements by status, with the counts of each status and of dismissals',
  request: { query: AnnouncementListQuery },
  responses: { 200: AnnouncementList },
});

export const platformCreateAnnouncement = defineContract({
  operationId: 'platformCreateAnnouncement',
  method: 'POST',
  path: '/platform/announcements',
  summary: 'Post a plain-text announcement to every clinic or to selected ones',
  request: { body: CreateAnnouncementRequest },
  responses: { 201: Announcement, 400: ErrorEnvelope },
});

export const platformUpdateAnnouncement = defineContract({
  operationId: 'platformUpdateAnnouncement',
  method: 'PATCH',
  path: '/platform/announcements/:id',
  summary: 'Edit an announcement that has not ended (a new body or level is a new version)',
  request: { params: AnnouncementIdParams, body: UpdateAnnouncementRequest },
  responses: { 200: Announcement, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformEndAnnouncement = defineContract({
  operationId: 'platformEndAnnouncement',
  method: 'POST',
  path: '/platform/announcements/:id/end',
  summary: 'End an announcement now (cancelling it when it has not started)',
  request: { params: AnnouncementIdParams },
  responses: { 200: Announcement, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const myAnnouncements = defineContract({
  operationId: 'myAnnouncements',
  method: 'GET',
  path: '/me/announcements',
  summary: 'The active announcements for this clinic the person has not hidden',
  responses: { 200: MyAnnouncements },
});

export const dismissMyAnnouncement = defineContract({
  operationId: 'dismissMyAnnouncement',
  method: 'POST',
  path: '/me/announcements/:id/dismiss',
  summary: 'Hide this version of an announcement for the person, on every device and clinic',
  request: { params: AnnouncementIdParams, body: DismissAnnouncementRequest },
  responses: { 204: null, 404: ErrorEnvelope },
});
