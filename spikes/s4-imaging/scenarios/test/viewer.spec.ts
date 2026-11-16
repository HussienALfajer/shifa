// Criterion 10: an unmodified OHIF opens the panoramic and the CBCT, through the gateway with a
// viewer session on P1, P2 and P3, and on the edge box over the LAN (no shaping): the first
// image renders, then the three MPR viewports render. Timings are recorded (criterion 11).
import { ensureStudy, type StudyName } from '@shifa-spike/s4-generator';
import {
  connectBrowser,
  firstImage,
  LONG,
  mprReady,
  openViewer,
  record,
  stowFiles,
} from '@shifa-spike/s4-scenarios';
import type { ProfileName } from '@shifa-spike/s4-stack';
import { useStack } from '@shifa-spike/s4-stack/testing';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const stack = useStack({ ops: false, browser: true, ohif: true, edge: true });
const CBCT: StudyName = LONG ? 'cbct-300-multi' : 'cbct-20-multi';
const TIMEOUT = LONG ? 3600_000 : 900_000;
let browser: Browser;
const uids: Record<string, string> = {};

beforeAll(async () => {
  browser = await connectBrowser(stack);
  const edge = stack.edge;
  if (!edge) throw new Error('edge not started');
  for (const name of ['pano', CBCT] as const) {
    const { dir, manifest } = await ensureStudy(name);
    const paths = manifest.files.map((f) => f.path);
    await stowFiles(stack, 'a', dir, paths);
    await edge.storescu(dir, paths);
    uids[name] = manifest.studyInstanceUid;
  }
});
afterAll(async () => {
  await browser.close();
});

const places: { label: string; profile: ProfileName | 'none'; edge: boolean }[] = [
  { label: 'P1', profile: 'P1', edge: false },
  { label: 'P2', profile: 'P2', edge: false },
  { label: 'P3', profile: 'P3', edge: false },
  { label: 'edge LAN', profile: 'none', edge: true },
];

describe('OHIF viewing', () => {
  for (const place of places) {
    it(`shows the panoramic and the CBCT with MPR (${place.label})`, async () => {
      await stack.link.applyProfile(place.profile);
      const via = place.edge ? { edge: true as const } : { gateway: 'a' as const };
      for (const [name, mpr] of [
        ['pano', false],
        [CBCT, true],
      ] as const) {
        const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
        const page = await context.newPage();
        try {
          const start = await openViewer(page, stack, { studyUid: uids[name] ?? '', mpr, via });
          const first = await firstImage(page, start, TIMEOUT);
          expect(first).toBeGreaterThan(0);
          const mprMs = mpr ? await mprReady(page, start, TIMEOUT) : null;
          await record('viewer', {
            place: place.label,
            study: name,
            long: LONG,
            firstImageMs: first,
            mprReadyMs: mprMs,
          });
        } finally {
          await context.close();
        }
      }
    });
  }
});
