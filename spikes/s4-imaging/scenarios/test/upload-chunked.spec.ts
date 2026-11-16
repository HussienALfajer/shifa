// Criterion 8: browser upload by the chunked resumable protocol on P1 with cuts. Multi-file,
// single-file and DICOMDIR studies finish; a reload mid-upload with the folder re-selected
// resumes from the server's offsets; two tabs on one folder end with one copy; the cloud holds
// exactly the source instances (count and SHA-256); bytes sent again stay under one chunk per
// interrupted file. Fast run: 20 MB studies, a 10 s cut every 60 s; S4_LONG=1: the 300 MB
// studies with the spec's cuts (30 s every 5 min).
import { ensureStudy, type Manifest, type StudyName } from '@shifa-spike/s4-generator';
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
const CHUNK = 1024 * 1024;
const STUDIES: StudyName[] = LONG
  ? ['cbct-300-multi', 'cbct-300-single']
  : ['cbct-20-multi', 'cbct-20-single', 'with-dicomdir'];
const CUTS = LONG
  ? { everySeconds: 300, cutSeconds: 30, offsetSeconds: 120 }
  : { everySeconds: 60, cutSeconds: 10, offsetSeconds: 20 };
const TIMEOUT = LONG ? 4 * 3600_000 : 1800_000;
let browser: Browser;

/** The cloud copy equals the manifest: same instances, same SHA-256, nothing else. */
async function expectCloudEquals(tenant: 'a' | 'b', manifest: Manifest) {
  await stack.link.applyProfile('none');
  try {
    const cloud = await cloudStudy(stack, tenant, manifest.studyInstanceUid);
    const source = new Map(manifest.files.map((f) => [f.sopInstanceUid, f.sha256]));
    expect(cloud).toEqual(source);
  } finally {
    await stack.link.applyProfile('P1');
  }
}

beforeAll(async () => {
  browser = await connectBrowser(stack);
});
afterAll(async () => {
  await browser.close();
});

describe('chunked resumable upload on P1', () => {
  for (const name of STUDIES) {
    it(`uploads ${name} through cuts`, async () => {
      const { dir, manifest } = await ensureStudy(name);
      const upload = await openUploadPage(browser, stack, { tenant: 'a', mode: 'chunked' });
      const before = await stack.link.counters();
      const stop = stack.link.schedule(CUTS);
      const started = Date.now();
      try {
        await selectAndStart(upload.page, dir);
        expect(await waitOutcome(upload.page, TIMEOUT)).toBe('done');
      } finally {
        await stop();
      }
      const ms = Date.now() - started;
      const after = await stack.link.counters();
      const sum = totals(upload.loads);
      const studyBytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
      if (name === 'with-dicomdir') {
        expect(upload.loads.at(-1)?.skipped.sort()).toEqual([...manifest.extras].sort());
      }
      expect(sum.ackedBytes).toBe(studyBytes);
      expect(sum.sentBytes - studyBytes).toBeLessThanOrEqual(CHUNK * sum.interrupted.length);
      await expectCloudEquals('a', manifest);
      await record('upload-chunked', {
        study: name,
        profile: 'P1',
        long: LONG,
        ms,
        studyBytes,
        sentBytes: sum.sentBytes,
        resentBytes: sum.sentBytes - studyBytes,
        interruptedFiles: sum.interrupted.length,
        linkUpBytes: after.upBytes - before.upBytes,
        linkDownBytes: after.downBytes - before.downBytes,
        cuts: stack.link.events.filter((e) => e.event === 'cut-start').length,
      });
      await upload.page.context().close();
    });
  }

  it('resumes from server offsets after a reload with the folder re-selected', async () => {
    const name: StudyName = LONG ? 'cbct-300-single' : 'cbct-20-single';
    const { dir, manifest } = await ensureStudy(name);
    const studyBytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
    const upload = await openUploadPage(browser, stack, { tenant: 'b', mode: 'chunked' });
    await selectAndStart(upload.page, dir);
    await expect
      .poll(() => upload.loads[0]?.ackedBytes ?? 0, { timeout: TIMEOUT, interval: 1000 })
      .toBeGreaterThan(studyBytes * 0.3);
    await upload.page.reload();
    await selectAndStart(upload.page, dir);
    expect(await waitOutcome(upload.page, TIMEOUT)).toBe('done');
    const [first, second] = upload.loads;
    expect(second?.resumedBytes).toBeGreaterThanOrEqual(first?.ackedBytes ?? Number.NaN);
    const sum = totals(upload.loads);
    // The reload interrupted the file once; at most one chunk goes again.
    expect(sum.sentBytes - studyBytes).toBeLessThanOrEqual(
      CHUNK * Math.max(1, sum.interrupted.length + 1),
    );
    await expectCloudEquals('b', manifest);
    await record('upload-chunked', {
      study: name,
      scenario: 'reload',
      resumedBytes: second?.resumedBytes,
      resentBytes: sum.sentBytes - studyBytes,
    });
    await upload.page.context().close();
  });

  it('ends with one copy when two tabs upload the same folder', async () => {
    const name: StudyName = 'cbct-20-multi';
    const { dir, manifest } = await ensureStudy(name);
    const tabs = await Promise.all(
      [0, 1].map(() => openUploadPage(browser, stack, { tenant: 'b', mode: 'chunked' })),
    );
    await Promise.all(tabs.map((t) => selectAndStart(t.page, dir)));
    for (const tab of tabs) expect(await waitOutcome(tab.page, TIMEOUT)).toBe('done');
    await expectCloudEquals('b', manifest);
    for (const tab of tabs) await tab.page.context().close();
  });
});
