// Criterion 8, comparison: the same studies by STOW-RS per instance with retry (exponential
// backoff with jitter, six attempts per instance) on P1 with the same cuts. Multi-file studies
// finish and match the source; a single large file is expected not to fit between cuts, so
// its outcome is recorded rather than asserted. Bytes sent again are recorded.
import { ensureStudy, type StudyName } from '@shifa-spike/s4-generator';
import {
  cloudStudy,
  connectBrowser,
  LONG,
  openUploadPage,
  record,
  selectAndStart,
  totals,
  waitOutcome,
} from '@shifa-spike/s4-scenarios';
import { useStack } from '@shifa-spike/s4-stack/testing';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const stack = useStack({ profile: 'P1', ops: false, browser: true });
const STUDIES: { name: StudyName; mustFinish: boolean }[] = LONG
  ? [
      { name: 'cbct-300-multi', mustFinish: true },
      { name: 'cbct-300-single', mustFinish: false },
    ]
  : [
      { name: 'cbct-20-multi', mustFinish: true },
      { name: 'with-dicomdir', mustFinish: true },
      { name: 'cbct-20-single', mustFinish: false },
    ];
const CUTS = LONG
  ? { everySeconds: 300, cutSeconds: 30, offsetSeconds: 120 }
  : { everySeconds: 60, cutSeconds: 10, offsetSeconds: 20 };
const TIMEOUT = LONG ? 4 * 3600_000 : 1800_000;
let browser: Browser;

beforeAll(async () => {
  browser = await connectBrowser(stack);
});
afterAll(async () => {
  await browser.close();
});

describe('STOW-RS per instance on P1', () => {
  for (const { name, mustFinish } of STUDIES) {
    it(`uploads ${name} by STOW-RS${mustFinish ? '' : ' (outcome recorded)'}`, async () => {
      const { dir, manifest } = await ensureStudy(name);
      const upload = await openUploadPage(browser, stack, { tenant: 'a', mode: 'stow' });
      const before = await stack.link.counters();
      const stop = stack.link.schedule(CUTS);
      const started = Date.now();
      let outcome: 'done' | 'failed' | 'timeout';
      try {
        await selectAndStart(upload.page, dir);
        outcome = await waitOutcome(upload.page, TIMEOUT).catch(() => 'timeout' as const);
      } finally {
        await stop();
      }
      const ms = Date.now() - started;
      const after = await stack.link.counters();
      const sum = totals(upload.loads);
      const studyBytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
      await stack.link.applyProfile('none');
      const cloud = await cloudStudy(stack, 'a', manifest.studyInstanceUid);
      await stack.link.applyProfile('P1');
      if (mustFinish) {
        expect(outcome).toBe('done');
        expect(cloud).toEqual(new Map(manifest.files.map((f) => [f.sopInstanceUid, f.sha256])));
      } else {
        // Whatever the outcome, nothing partial or altered is stored.
        for (const [sop, hash] of cloud) {
          expect(manifest.files.find((f) => f.sopInstanceUid === sop)?.sha256).toBe(hash);
        }
      }
      await record('upload-stow', {
        study: name,
        profile: 'P1',
        long: LONG,
        outcome,
        ms,
        studyBytes,
        storedInstances: cloud.size,
        sentBytes: sum.sentBytes,
        resentBytes: sum.sentBytes - sum.ackedBytes,
        linkUpBytes: after.upBytes - before.upBytes,
      });
      await upload.page.context().close();
    });
  }
});
