// ci.yml's `verify e2e` job (slice A-01-06): read-only, no secret, the pinned database images and
// Playwright's Chromium prepared before the part runs, traces uploaded on failure only. The part,
// the needs and the aggregator are checked with the other parts in ci-verify-jobs.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..', '..');
const ci = parse(readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8'));
const job = ci.jobs.e2e;
const names = () => job.steps.map((s) => s.name ?? s.uses ?? s.run);

describe('ci.yml verify e2e', () => {
  it('reads the repository only and uses no secret', () => {
    assert.deepEqual(job.permissions, { contents: 'read' });
    assert.ok(!/secrets\./.test(JSON.stringify(job)));
    const checkout = job.steps.find((s) => /^actions\/checkout@[0-9a-f]{40}/.test(s.uses ?? ''));
    assert.equal(checkout?.with?.['persist-credentials'], false);
  });

  it('prepares the database images and Chromium before the part runs', () => {
    const order = names();
    const part = order.indexOf('verify full --part e2e');
    assert.ok(part > order.indexOf('Pull database test images'));
    assert.ok(part > order.indexOf('Install Chromium'));
    const install = job.steps.find((s) => s.name === 'Install Chromium');
    assert.match(
      install.run,
      /pnpm --filter @shifa\/e2e exec playwright install --with-deps chromium/,
    );
  });

  it('keeps traces for failed journeys only, for a week', () => {
    assert.equal(job.env?.E2E_TRACE, '1');
    const upload = job.steps.find((s) =>
      /actions\/upload-artifact@[0-9a-f]{40}/.test(s.uses ?? ''),
    );
    assert.equal(upload?.if, 'failure()');
    assert.equal(upload.with.path, 'e2e/test-results/');
    assert.equal(upload.with['retention-days'], 7);
  });
});
