// Criterion 9 (IMG-17): the edge box. storescu sends a study to the edge Orthanc on the clinic
// LAN; the edge pushes it with the Transfers plugin through the link and the gateway to its
// tenant's cloud Orthanc. On P1 with cuts and an edge Orthanc restart at about 40 % of the job,
// the push completes (the job resumes, or the test resubmits it and records which); the cloud
// study equals the source (count and SHA-256). Bytes on the wire are recorded against the study.
import { ensureStudy, type StudyName } from '@shifa-spike/s4-generator';
import { cloudStudy, LONG, record } from '@shifa-spike/s4-scenarios';
import { useStack } from '@shifa-spike/s4-stack/testing';
import { describe, expect, it } from 'vitest';

const stack = useStack({ profile: 'P1', ops: false, edge: true });
const NAME: StudyName = LONG ? 'cbct-300-multi' : 'cbct-20-multi';
const CUTS = LONG
  ? { everySeconds: 300, cutSeconds: 30, offsetSeconds: 120 }
  : { everySeconds: 60, cutSeconds: 10, offsetSeconds: 20 };
const TIMEOUT = LONG ? 4 * 3600_000 : 1800_000;

describe('edge box push on P1', () => {
  it('pushes through cuts and an edge restart and matches the source', async () => {
    const edge = stack.edge;
    if (!edge) throw new Error('edge not started');
    const { dir, manifest } = await ensureStudy(NAME);
    await edge.storescu(
      dir,
      manifest.files.map((f) => f.path),
    );
    const before = await stack.link.counters();
    const stop = stack.link.schedule(CUTS);
    const started = Date.now();
    let job = await edge.push(manifest.studyInstanceUid);
    let restarted = false;
    const resubmits: string[] = [];
    let state = '';
    try {
      while (Date.now() - started < TIMEOUT) {
        const current = await edge.job(job);
        state = current.State;
        if (state === 'Success') break;
        if (!restarted && current.Progress >= 40) {
          await edge.restart();
          restarted = true;
          continue;
        }
        if (state === 'Failure') {
          resubmits.push(current.ErrorDescription);
          job = await edge.resubmit(job);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } finally {
      await stop();
    }
    const ms = Date.now() - started;
    const after = await stack.link.counters();
    expect(state).toBe('Success');
    expect(restarted).toBe(true);
    await stack.link.applyProfile('none');
    const cloud = await cloudStudy(stack, 'a', manifest.studyInstanceUid);
    await stack.link.applyProfile('P1');
    expect(cloud).toEqual(new Map(manifest.files.map((f) => [f.sopInstanceUid, f.sha256])));
    const studyBytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
    await record('edge-push', {
      study: NAME,
      profile: 'P1',
      long: LONG,
      ms,
      studyBytes,
      linkUpBytes: after.upBytes - before.upBytes,
      wireRatio: (after.upBytes - before.upBytes) / studyBytes,
      resubmits: resubmits.length,
      restartResumedJob: resubmits.length === 0,
    });
  });
});
