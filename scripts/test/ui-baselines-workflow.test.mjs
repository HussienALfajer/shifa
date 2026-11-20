// Slice 0.4-03: the screenshot baselines of packages/ui are produced only inside the pinned
// Playwright image. ui-baselines.yml makes them on demand where Docker is blocked (the sandboxed
// WSL2 session, OD-24) and hands them over as an artifact: it never pushes and holds no write
// permission. The image is pinned by digest, at the version of the Playwright packages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..', '..');
const text = readFileSync(join(root, '.github', 'workflows', 'ui-baselines.yml'), 'utf8');
const workflow = parse(text);
const jobs = Object.entries(workflow.jobs ?? {});
const steps = jobs.flatMap(([, job]) => job.steps ?? []);
const runs = steps.map((s) => (typeof s.run === 'string' ? s.run : '')).join('\n');

describe('ui-baselines.yml', () => {
  it('runs on manual dispatch only', () => {
    assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  });

  it('reads the repository and writes nothing: contents read, no write anywhere', () => {
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    for (const [id, job] of jobs) {
      for (const [scope, level] of Object.entries(job.permissions ?? {})) {
        assert.notEqual(level, 'write', `${id}: ${scope}: write`);
      }
    }
    assert.doesNotMatch(text, /:\s*write\b/);
  });

  it('pins every action by commit SHA and keeps no credentials in the checkout', () => {
    for (const step of steps.filter((s) => s.uses)) {
      assert.match(step.uses, /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/, step.uses);
    }
    const checkout = steps.find((s) => /^actions\/checkout@/.test(s.uses ?? ''));
    assert.equal(checkout?.with?.['persist-credentials'], false);
  });

  it('never commits or pushes, and uses no secret', () => {
    assert.doesNotMatch(runs, /\bgit\s+(push|commit)\b/);
    assert.doesNotMatch(text, /secrets\./);
    assert.ok(!steps.some((s) => /git-auto-commit|create-pull-request|push/i.test(s.uses ?? '')));
  });

  it('updates the baselines in the pinned image and uploads them as an artifact', () => {
    assert.match(
      runs,
      /docker pull --quiet "\$\(node packages\/ui\/scripts\/screenshot-image\.ts\)"/,
    );
    assert.match(runs, /pnpm --filter @shifa\/ui storybook:build/);
    assert.match(runs, /pnpm --filter @shifa\/ui screenshots --update/);
    const upload = steps.find((s) => /^actions\/upload-artifact@/.test(s.uses ?? ''));
    assert.equal(upload?.with?.path, 'packages/ui/screenshots/baselines/');
    assert.equal(upload?.with?.['if-no-files-found'], 'error');
  });
});

describe('the screenshot image pin', () => {
  const source = readFileSync(
    join(root, 'packages', 'ui', 'scripts', 'screenshot-image.ts'),
    'utf8',
  );
  const ui = JSON.parse(readFileSync(join(root, 'packages', 'ui', 'package.json'), 'utf8'));
  const pinned =
    /'mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble@sha256:([0-9a-f]{64})'/.exec(source);

  it('names the Playwright image by tag and digest', () => {
    assert.ok(
      pinned,
      'screenshot-image.ts must hold mcr.microsoft.com/playwright:v<x.y.z>-noble@sha256:<digest>',
    );
  });

  it('is the version of @playwright/test and playwright in packages/ui', () => {
    assert.equal(pinned?.[1], ui.devDependencies['@playwright/test']);
    assert.equal(pinned?.[1], ui.devDependencies.playwright);
  });
});
