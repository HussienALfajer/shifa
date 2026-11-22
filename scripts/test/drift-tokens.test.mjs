// The tokens drift check regenerates the web theme and the Dart theme file with the real build,
// against a temp copy of the token source, so a changed token without regenerated outputs fails
// check-drift (spec 0.4, criterion 2).
import assert from 'node:assert/strict';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import config from '../drift.config.mjs';
import { formatReport, runDrift } from '../lib/drift.mjs';
import { tokensCheck } from '../lib/drift-tokens.mjs';

const repo = join(import.meta.dirname, '..', '..');
const generator = join(repo, 'packages', 'tokens', 'scripts', 'build.ts');
const CSS = 'packages/tokens/generated/css/tokens.css';
const TAILWIND = 'packages/tokens/generated/css/tailwind-theme.css';
const DART = 'packages/shifa_ui/lib/src/generated/tokens.g.dart';
const DESIGN_SYSTEM = 'packages/tokens/generated/design-system/tokens.json';
const FLUTTER_FONTS = 'packages/shifa_ui/fonts';
const NASKH_TTF = 'noto-naskh-arabic/ttf/noto-naskh-arabic-400.ttf';

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'drift-tokens-'));
  for (const dir of [
    'packages/tokens/src',
    'packages/tokens/fonts',
    'packages/tokens/generated',
    'packages/shifa_ui/lib/src/generated',
    FLUTTER_FONTS,
  ]) {
    // The Flutter fonts are a generated output: before the build writes them there is nothing to copy.
    if (existsSync(join(repo, dir))) cpSync(join(repo, dir), join(root, dir), { recursive: true });
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const drift = (options = {}) =>
  runDrift({
    root,
    checks: [tokensCheck({ generator })],
    logDir: join(root, '.logs'),
    ...options,
  });

function edit(file, change) {
  const path = join(root, 'packages', 'tokens', 'src', file);
  writeFileSync(
    path,
    `${JSON.stringify(change(JSON.parse(readFileSync(path, 'utf8'))), null, 2)}\n`,
  );
}

/** Leaf green becomes a slightly different green: every output that carries a colour changes. */
const changeGreen = () =>
  edit('primitive/color.tokens.json', (doc) => {
    doc.color.jasmine.green['600'].$value = {
      colorSpace: 'srgb',
      components: [32 / 255, 112 / 255, 92 / 255],
      hex: '#20705c',
    };
    return doc;
  });

describe('tokensCheck', () => {
  it('is registered, owns the outputs (web, Dart, Flutter fonts) and names the fix', () => {
    const check = config.find((c) => c.name === 'tokens');
    assert.ok(check, 'no `tokens` entry in scripts/drift.config.mjs');
    assert.deepEqual(check.outputs, ['packages/tokens/generated', DART, FLUTTER_FONTS]);
    assert.deepEqual(check.inputs, [
      'packages/tokens/src',
      'packages/tokens/scripts',
      'packages/tokens/fonts',
    ]);
    assert.match(check.hint, /check-drift\.mjs --fix/);
    assert.notEqual(check.full, true, 'the tokens check must run in fast verify');
  });

  it('is clean for the committed source and generated files', async () => {
    const { code, results } = await drift();
    assert.equal(code, 0, JSON.stringify(results));
  });

  it('red: a changed colour without regenerated outputs reports DRIFT tokens', async () => {
    changeGreen();
    const { code, results } = await drift();
    assert.equal(code, 1);
    assert.deepEqual(results[0].stale.sort(), [DART, CSS, DESIGN_SYSTEM].sort());
    const report = formatReport(results);
    assert.match(report, /DRIFT {4}tokens/);
    assert.match(report, /check-drift\.mjs --fix/);
  });

  it('green: --fix regenerates the outputs and the next run is clean', async () => {
    changeGreen();
    const fixed = await drift({ fix: true });
    assert.equal(fixed.code, 0);
    assert.equal(fixed.results[0].status, 'fixed');
    assert.match(readFileSync(join(root, CSS), 'utf8'), /#20705c/);
    assert.match(readFileSync(join(root, DART), 'utf8'), /0xFF20705C/);
    assert.match(readFileSync(join(root, DESIGN_SYSTEM), 'utf8'), /"#20705c"/);
    const { code, results } = await drift();
    assert.equal(code, 0, JSON.stringify(results));
    assert.equal(results[0].status, 'clean');
  });

  it('red: a hand-edited generated file is stale', async () => {
    const path = join(root, TAILWIND);
    writeFileSync(path, `${readFileSync(path, 'utf8')}/* edited */\n`);
    const { code, results } = await drift();
    assert.equal(code, 1);
    assert.deepEqual(results[0].stale, [TAILWIND]);
  });

  it('red: a hand-edited design-system tokens file is stale', async () => {
    const path = join(root, DESIGN_SYSTEM);
    writeFileSync(path, readFileSync(path, 'utf8').replace('"Shifa"', '"Edited"'));
    const { code, results } = await drift();
    assert.equal(code, 1);
    assert.deepEqual(results[0].stale, [DESIGN_SYSTEM]);
  });

  it('red: a deleted Dart file is missing, a stray generated file is extra', async () => {
    rmSync(join(root, DART));
    writeFileSync(join(root, 'packages/tokens/generated/css/old.css'), ':root {}\n');
    const { code, results } = await drift();
    assert.equal(code, 1);
    assert.deepEqual(results[0].missing, [DART]);
    assert.deepEqual(results[0].extra, ['packages/tokens/generated/css/old.css']);
  });

  it('the Flutter fonts are the TTFs and licences of fonts.json, byte for byte', () => {
    const fonts = join(repo, FLUTTER_FONTS);
    for (const file of [
      'ibm-plex-sans-arabic-400.ttf',
      'ibm-plex-sans-arabic-500.ttf',
      'ibm-plex-sans-arabic-600.ttf',
      'ibm-plex-sans-arabic-700.ttf',
      'noto-naskh-arabic-400.ttf',
      'noto-naskh-arabic-700.ttf',
    ]) {
      const family = file.replace(/-\d+\.ttf$/, '');
      assert.deepEqual(
        readFileSync(join(fonts, file)),
        readFileSync(join(repo, 'packages/tokens/fonts', family, 'ttf', file)),
        file,
      );
    }
    assert.match(
      readFileSync(join(fonts, 'ibm-plex-sans-arabic-OFL.txt'), 'utf8'),
      /SIL OPEN FONT LICENSE/i,
    );
    assert.match(
      readFileSync(join(fonts, 'noto-naskh-arabic-OFL.txt'), 'utf8'),
      /SIL OPEN FONT LICENSE/i,
    );
  });

  it('red: a changed font file without regenerated Flutter fonts reports DRIFT tokens', async () => {
    appendFileSync(join(root, 'packages/tokens/fonts', NASKH_TTF), Buffer.from([0]));
    const { code, results } = await drift();
    assert.equal(code, 1);
    assert.deepEqual(results[0].stale, [`${FLUTTER_FONTS}/noto-naskh-arabic-400.ttf`]);
    const fixed = await drift({ fix: true });
    assert.equal(fixed.code, 0);
    assert.equal((await drift()).code, 0);
  });

  it('a token source that breaks the schema crashes the check instead of writing outputs', async () => {
    edit('contrast-pairs.json', () => []);
    const { code, results } = await drift();
    assert.equal(code, 2);
    assert.equal(results[0].status, 'crash');
    assert.match(readFileSync(results[0].logPath, 'utf8'), /no contrast pair/);
  });
});
