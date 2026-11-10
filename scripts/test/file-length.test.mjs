import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countCodeLines, isGeneratedDart, MAX_LINES, tooLong } from '../lib/file-length.mjs';

const code = (n) => Array.from({ length: n }, (_, i) => `final a${i} = ${i};`).join('\n');

describe('countCodeLines', () => {
  it('skips blank lines and comments, like ESLint max-lines', () => {
    const src = [
      '// line comment',
      '/// doc comment',
      '',
      '/* block',
      '   still block */',
      'void main() {}',
      '  ',
      'final x = 1; // trailing comment counts as code',
    ].join('\n');
    assert.equal(countCodeLines(src), 2);
  });

  it('counts code after a block comment closes on the same line', () => {
    assert.equal(countCodeLines('/* a */ final x = 1;\n/* b\n*/ final y = 2;'), 2);
  });
});

describe('isGeneratedDart', () => {
  it('recognises build_runner and freezed output', () => {
    assert.equal(isGeneratedDart('packages/x/lib/a.g.dart'), true);
    assert.equal(isGeneratedDart('apps/patient_app/lib/m.freezed.dart'), true);
    assert.equal(isGeneratedDart('apps/patient_app/test/m.mocks.dart'), true);
    assert.equal(
      isGeneratedDart('packages/api_client_dart/lib/src/generated/models/error_body.dart'),
      true,
    );
    assert.equal(isGeneratedDart('packages/x/lib/generated/l10n.dart'), true);
    assert.equal(isGeneratedDart('packages/x/lib/clock.dart'), false);
    // The client's barrel and tests are hand-written and keep the limit.
    assert.equal(isGeneratedDart('packages/api_client_dart/lib/api_client_dart.dart'), false);
    assert.equal(isGeneratedDart('packages/api_client_dart/test/fixtures_test.dart'), false);
  });
});

describe('tooLong', () => {
  it(`passes ${MAX_LINES} lines and fails ${MAX_LINES + 1}`, () => {
    assert.deepEqual(tooLong([{ path: 'a.dart', source: code(MAX_LINES) }]), []);
    assert.deepEqual(tooLong([{ path: 'b.dart', source: code(MAX_LINES + 1) }]), [
      { path: 'b.dart', lines: MAX_LINES + 1 },
    ]);
  });

  it('ignores generated files of any length', () => {
    assert.deepEqual(tooLong([{ path: 'lib/a.g.dart', source: code(1000) }]), []);
  });
});
