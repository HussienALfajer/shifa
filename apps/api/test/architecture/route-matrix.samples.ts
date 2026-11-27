// Sample requests of the A-02 console routes (cities and areas, A-02-06; announcements and usage,
// A-02-07), kept beside route-matrix.expected.ts, which spreads them into SAMPLE_REQUESTS.
import { randomUUID } from 'node:crypto';
import type { Sample } from './route-matrix.expected.ts';

export const A02_CONSOLE_SAMPLES: Readonly<Record<string, Sample>> = {
  // A-02-06: cities and areas (a fresh place per call: archives and restores change it)
  'POST /platform/cities': () => ({
    body: { name: `مدينة ${String(Math.random()).slice(2, 10)}` },
  }),
  'PATCH /platform/cities/:id': async (ctx) => ({
    url: `/platform/cities/${await ctx.placeId('city')}`,
    body: { name: `مدينة ${String(Math.random()).slice(2, 10)}` },
  }),
  'POST /platform/cities/:id/archive': async (ctx) => ({
    url: `/platform/cities/${await ctx.placeId('city')}/archive`,
  }),
  'POST /platform/cities/:id/restore': async (ctx) => ({
    url: `/platform/cities/${await ctx.placeId('city', 'archived')}/restore`,
  }),
  'POST /platform/cities/:id/areas': async (ctx) => ({
    url: `/platform/cities/${await ctx.placeId('city')}/areas`,
    body: { name: 'منطقة المصفوفة' },
  }),
  'PATCH /platform/areas/:id': async (ctx) => ({
    url: `/platform/areas/${await ctx.placeId('area')}`,
    body: { name: `منطقة ${String(Math.random()).slice(2, 10)}` },
  }),
  'POST /platform/areas/:id/archive': async (ctx) => ({
    url: `/platform/areas/${await ctx.placeId('area')}/archive`,
  }),
  'POST /platform/areas/:id/restore': async (ctx) => ({
    url: `/platform/areas/${await ctx.placeId('area', 'archived')}/restore`,
  }),
  // A-02-07: announcements (a fresh one per edit, end or dismissal) and a clinic's usage
  'POST /platform/announcements': () => ({
    body: {
      body: 'إعلان المصفوفة',
      level: 'info',
      startsAt: new Date().toISOString(),
      target: 'all',
    },
  }),
  'PATCH /platform/announcements/:id': async (ctx) => ({
    url: `/platform/announcements/${await ctx.announcementId()}`,
    body: { level: 'warning' },
  }),
  'POST /platform/announcements/:id/end': async (ctx) => ({
    url: `/platform/announcements/${await ctx.announcementId()}/end`,
  }),
  'POST /me/announcements/:id/dismiss': async (ctx) => ({
    url: `/me/announcements/${await ctx.announcementId()}/dismiss`,
    body: { version: 1 },
  }),
  'GET /platform/clinics/:id/usage': (ctx) => ({ url: `/platform/clinics/${ctx.clinicId}/usage` }),
};

/** Sample requests of the A-03-02 chart routes: a fresh chart per call (edits move updatedAt). */
export const A03_PATIENT_SAMPLES: Readonly<Record<string, Sample>> = {
  'POST /patients': (ctx) => ({
    body: {
      id: randomUUID(),
      givenName: 'مريض',
      familyName: 'المصفوفة',
      contactPhone: ctx.nextPhone(),
      sex: 'female',
      age: { value: 30, unit: 'years' },
    },
  }),
  'POST /patients/search': () => ({ body: { term: 'مريض' } }),
  'GET /patients/:id': async (ctx) => ({ url: `/patients/${(await ctx.chart()).id}` }),
  'PATCH /patients/:id': async (ctx) => {
    const chart = await ctx.chart();
    return {
      url: `/patients/${chart.id}`,
      body: { expectedUpdatedAt: chart.updatedAt, motherName: 'ليلى' },
    };
  },
  'POST /patients/:id/archive': async (ctx) => {
    const chart = await ctx.chart();
    return { url: `/patients/${chart.id}/archive`, body: { expectedUpdatedAt: chart.updatedAt } };
  },
  'POST /patients/:id/restore': async (ctx) => {
    const chart = await ctx.chart('archived');
    return { url: `/patients/${chart.id}/restore`, body: { expectedUpdatedAt: chart.updatedAt } };
  },
};
