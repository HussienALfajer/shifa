// Privacy across the clinic-side paths: after a browser upload, an edge push and an OHIF view,
// no container log (gateway, cloud and edge Orthanc, OHIF nginx on both sides, the link,
// PostgreSQL, Garage, the browser) holds the synthetic name marker, a token or a per-run secret.
import { ensureStudy, SYNTHETIC_MARKER } from '@shifa-spike/s4-generator';
import {
  connectBrowser,
  firstImage,
  openUploadPage,
  openViewer,
  selectAndStart,
  waitOutcome,
} from '@shifa-spike/s4-scenarios';
import { useStack } from '@shifa-spike/s4-stack/testing';
import { describe, expect, it } from 'vitest';

const stack = useStack({ ops: false, browser: true, ohif: true, edge: true });

describe('no PHI, tokens or keys in clinic-side logs', () => {
  it('keeps every log clean after upload, edge push and viewing', async () => {
    const { dir, manifest } = await ensureStudy('with-dicomdir');
    const browser = await connectBrowser(stack);
    try {
      const upload = await openUploadPage(browser, stack, { tenant: 'a', mode: 'chunked' });
      await selectAndStart(upload.page, dir);
      expect(await waitOutcome(upload.page, 600_000)).toBe('done');

      const edge = stack.edge;
      if (!edge) throw new Error('edge not started');
      const pano = await ensureStudy('pano');
      await edge.storescu(
        pano.dir,
        pano.manifest.files.map((f) => f.path),
      );
      const job = await edge.push(pano.manifest.studyInstanceUid);
      expect((await edge.waitJob(job, 600_000)).State).toBe('Success');

      const page = await (await browser.newContext()).newPage();
      const start = await openViewer(page, stack, {
        studyUid: manifest.studyInstanceUid,
        mpr: false,
        via: { gateway: 'a' },
      });
      await firstImage(page, start, 600_000);
    } finally {
      await browser.close();
    }

    const secrets = stack.secrets();
    const containers = stack.containers().filter((c) => !c.endsWith('-dcmtk'));
    expect(containers.length).toBeGreaterThanOrEqual(10);
    for (const container of containers) {
      const logs = await stack.logs(container);
      expect(logs.includes(SYNTHETIC_MARKER), `${container}: marker`).toBe(false);
      expect(logs.includes('eyJ'), `${container}: token`).toBe(false);
      expect(
        secrets.filter((s) => logs.includes(s)),
        `${container}: secret`,
      ).toEqual([]);
    }
  });
});
