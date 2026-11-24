// The verify scheduler (scripts/lib/verify-steps.mjs): independent steps overlap, `after` and
// `requires` order them, a failed requirement skips its dependents, results keep the declared
// order, and the real step graph keeps the serialisations verify.mjs relies on.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runSteps, verifySteps } from '../lib/verify-steps.mjs';

/** An exec that logs start/end events; a step ends when the test opens its gate. */
function recorder(codes = {}) {
  const events = [];
  const gates = new Map();
  const gate = (name) => {
    if (!gates.has(name)) {
      let open;
      const promise = new Promise((resolve) => {
        open = resolve;
      });
      gates.set(name, { promise, open });
    }
    return gates.get(name);
  };
  const exec = async (step) => {
    events.push(`start:${step.name}`);
    await gate(step.name).promise;
    events.push(`end:${step.name}`);
    return { code: codes[step.name] ?? 0, output: `${step.name} output\n` };
  };
  return { events, exec, open: (...names) => names.forEach((n) => gate(n).open()) };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));
const step = (name, extra = {}) => ({ name, cmd: 'x', args: [], ...extra });

describe('runSteps', () => {
  it('starts independent steps together and keeps the declared order in the results', async () => {
    const { events, exec, open } = recorder();
    const run = runSteps([step('a'), step('b'), step('c')], exec);
    await settle();
    assert.deepEqual(events, ['start:a', 'start:b', 'start:c']);
    open('c');
    await settle();
    open('a', 'b');
    const results = await run;
    assert.deepEqual(
      results.map((r) => r.name),
      ['a', 'b', 'c'],
    );
    assert.ok(events.indexOf('end:c') < events.indexOf('end:a'));
  });

  it('`after` waits for a step and runs whatever its result', async () => {
    const { events, exec, open } = recorder({ pub: 1 });
    const run = runSteps([step('pub'), step('drift', { after: ['pub'] }), step('lint')], exec);
    await settle();
    assert.deepEqual(events, ['start:pub', 'start:lint']);
    open('pub');
    await settle();
    assert.deepEqual(events.slice(2), ['end:pub', 'start:drift']);
    open('drift', 'lint');
    const [pub, drift] = await run;
    assert.equal(pub.code, 1);
    assert.equal(drift.skipped, false);
    assert.equal(drift.code, 0);
  });

  it('`requires` waits, then skips the step and its dependents when the requirement failed', async () => {
    const { events, exec, open } = recorder({ build: 1 });
    open('build', 'other');
    const [build, boot, afterBoot, other] = await runSteps(
      [
        step('build'),
        step('boot', { requires: 'build' }),
        step('after-boot', { requires: 'boot' }),
        step('other'),
      ],
      exec,
    );
    assert.equal(build.code, 1);
    assert.equal(boot.skipped, true);
    assert.equal(boot.code, 1);
    assert.equal(boot.seconds, '0.0');
    assert.match(boot.output, /skipped: build failed/);
    assert.equal(afterBoot.skipped, true);
    assert.match(afterBoot.output, /skipped: boot failed/);
    assert.equal(other.code, 0);
    assert.ok(!events.includes('start:boot'));
  });

  it('`requires` runs the step once the requirement passed', async () => {
    const { events, exec, open } = recorder();
    const run = runSteps([step('pub'), step('turbo', { requires: 'pub' })], exec);
    await settle();
    assert.deepEqual(events, ['start:pub']);
    open('pub', 'turbo');
    const [, turbo] = await run;
    assert.equal(turbo.skipped, false);
    assert.deepEqual(events, ['start:pub', 'end:pub', 'start:turbo', 'end:turbo']);
  });

  it('runs a step whose dependencies the mode filtered out', async () => {
    const { exec, open } = recorder();
    open('boot');
    const [boot] = await runSteps([step('boot', { requires: 'build', after: ['x'] })], exec);
    assert.equal(boot.skipped, false);
    assert.equal(boot.code, 0);
  });

  it('refuses a step declared before its dependency, before running anything', async () => {
    const { events, exec } = recorder();
    await assert.rejects(
      runSteps([step('lint'), step('drift', { after: ['pub'] }), step('pub')], exec),
      /drift must come after pub/,
    );
    await settle();
    assert.deepEqual(events, []);
  });

  it('counts a step whose exec throws as failed', async () => {
    const [r] = await runSteps([step('a')], () => Promise.reject(new Error('spawn failed')));
    assert.equal(r.code, 1);
    assert.match(r.output, /spawn failed/);
  });

  it('times each step from its own start', async () => {
    let clock = 0;
    const exec = async (s) => {
      clock += s.name === 'slow' ? 5000 : 1000;
      return { code: 0, output: '' };
    };
    const [slow, fast] = await runSteps([step('slow'), step('fast', { after: ['slow'] })], exec, {
      now: () => clock,
    });
    assert.equal(slow.seconds, '5.0');
    assert.equal(fast.seconds, '1.0');
  });
});

describe('verifySteps', () => {
  const names = (mode) => verifySteps(mode).map((s) => s.name);
  const byName = (mode) => Object.fromEntries(verifySteps(mode).map((s) => [s.name, s]));

  it('docs mode runs only the steps that read docs and repository scripts', () => {
    assert.deepEqual(names('docs'), [
      'format',
      'instructions',
      'lint-root',
      'scripts-test',
      'file-length',
    ]);
  });

  it('fast mode has no build, boot or ui step; full mode ends with them and e2e', () => {
    assert.ok(!names('fast').includes('build'));
    assert.ok(!names('fast').includes('boot'));
    assert.deepEqual(
      names('fast').filter((n) => n.startsWith('ui-')),
      [],
    );
    // e2e runs in both modes; fast mode decides inside the step (scripts/lib/e2e.mjs).
    assert.ok(names('fast').includes('e2e'));
    assert.deepEqual(names('full').slice(-7), [
      'build',
      'boot',
      'e2e',
      'ui-browser',
      'ui-storybook',
      'ui-storybook-build',
      'ui-screenshots',
    ]);
  });

  it('keeps the serialisations: pub-get before drift and turbo, turbo before build', () => {
    const full = byName('full');
    assert.deepEqual(full.drift.after, ['pub-get']);
    assert.equal(full['typecheck+lint+test'].requires, 'pub-get');
    assert.deepEqual(full.build.after, ['typecheck+lint+test']);
    assert.equal(full.boot.requires, 'build');
  });

  it('names only known steps, each declared before the steps that wait for it', () => {
    const known = new Set(names('full'));
    for (const mode of ['fast', 'full', 'docs']) {
      const steps = verifySteps(mode);
      for (const [i, s] of steps.entries()) {
        for (const dep of [...(s.after ?? []), ...(s.requires ? [s.requires] : [])]) {
          assert.ok(known.has(dep), `${s.name} names unknown step ${dep}`);
          const at = steps.findIndex((x) => x.name === dep);
          assert.ok(at < i, `${mode}: ${s.name} is declared before ${dep}`);
        }
      }
    }
  });

  it('full mode forces turbo and runs drift --full; fast mode passes --affected through', () => {
    assert.ok(byName('full')['typecheck+lint+test'].args.includes('--force'));
    assert.ok(byName('full').drift.args.includes('--full'));
    const turbo = verifySteps('fast', { affected: ['--affected'] }).find(
      (s) => s.name === 'typecheck+lint+test',
    );
    assert.ok(turbo?.args.includes('--affected'));
    assert.ok(!turbo?.args.includes('--force'));
  });
});
