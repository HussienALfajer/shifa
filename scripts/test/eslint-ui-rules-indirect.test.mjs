// Slice 0.4-03 review: the class and style rules follow a class context into the places real
// components put it: a `const`, a state function (UI SDK's `className={(state) => …}`), a style
// object kept in a constant or spread, story args, and Tailwind's newer logical utilities. Test
// files are exempt from the two class rules (fixture geometry), not from the import rules.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ESLint, RuleTester } from 'eslint';
import { createConfig } from '../../tooling/eslint-config/index.js';
import { noHardcodedDesignValuesRule } from '../../tooling/eslint-config/rules/no-hardcoded-design-values.js';
import { noPhysicalDirectionRule } from '../../tooling/eslint-config/rules/no-physical-direction.js';

const root = join(import.meta.dirname, '..', '..');
const parser = createConfig({ tsconfigRootDir: root }).find((c) => c.languageOptions?.parser)
  ?.languageOptions.parser;
const tester = new RuleTester({
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});
const spacing = [{ spacing: ['0', '0.5', '1', '2', '3', '4', '8', '16'] }];
const bad = (code, messageId, count = 1, options) => ({
  code,
  ...(options ? { options } : {}),
  errors: Array.from({ length: count }, () => ({ messageId })),
});

describe('no-physical-direction through constants and functions', () => {
  it('runs the RuleTester cases', () => {
    tester.run('no-physical-direction', noPhysicalDirectionRule, {
      valid: [
        "const base = 'ms-2 text-start';\nexport const a = <div className={base} />;",
        "export const b = <div className={(s) => (s.open ? 'ms-2' : 'me-2')} />;",
        'const s = { marginInlineStart: 4 };\nexport const c = <div style={s} />;',
        // A constant no class context names is data, not classes.
        "export const d = { side: 'left-0' };",
      ],
      invalid: [
        bad(
          "export const a = <div className={(s) => (s.open ? 'ml-2' : 'mr-2')} />;",
          'physicalClass',
          2,
        ),
        bad(
          "const base = 'ml-2 text-left';\nexport const b = <div className={base} />;",
          'physicalClass',
          2,
        ),
        bad(
          'const s = { marginLeft: 4 };\nexport const c = <div style={s} />;',
          'physicalProperty',
        ),
        bad("export const S = { args: { className: 'ml-2' } };", 'physicalClass'),
        bad(
          'const edge = { left: 0 };\nexport const d = <div style={{ ...edge, top: 0 }} />;',
          'physicalProperty',
        ),
        bad(
          'export const e = <div style={(s) => (s.open ? { right: 0 } : { right: 4 })} />;',
          'physicalProperty',
          2,
        ),
        bad(
          "export const f = <div className={(s) => { if (s.a) return 'pl-2'; return 'pr-2'; }} />;",
          'physicalClass',
          2,
        ),
        // A constant used twice is reported once.
        bad(
          "const base = 'ml-2';\nexport const g = <><i className={base} /><b className={base} /></>;",
          'physicalClass',
        ),
      ],
    });
  });
});

describe('no-hardcoded-design-values through constants and newer utilities', () => {
  it('runs the RuleTester cases', () => {
    tester.run('no-hardcoded-design-values', noHardcodedDesignValuesRule, {
      valid: [
        {
          code: "export const a = <div className='pbs-4 mbe-2 inline-full inset-s-0 block' />;",
          options: spacing,
        },
        {
          code: "export const b = <div className='inline-flex min-inline-0' />;",
          options: spacing,
        },
      ],
      invalid: [
        bad(
          "export const a = <div className='pbs-14 inline-64 inset-s-14 mbs-7.5' />;",
          'spacingStep',
          4,
          spacing,
        ),
        bad(
          'const NARROW = { width: 256 };\nexport const b = <div style={NARROW} />;',
          'hardcodedLength',
          1,
          spacing,
        ),
        bad(
          "const base = 'p-[13px]';\nexport const c = <div className={base} />;",
          'arbitraryValue',
          1,
          spacing,
        ),
      ],
    });
  });
});

describe('test files', () => {
  it('may draw fixture geometry, but still may not import the agent bridge', async () => {
    const cwd = join(root, 'packages', 'ui');
    const code =
      "import { connect } from '@ui-sdk/react/agent';\nexport const a = <div className='ml-2 gap-x-14' style={{ width: 256 }} />;\nexport { connect };\n";
    // An existing test file, so the type-aware parser finds it in the package's tsconfig.
    const [result] = await new ESLint({ cwd }).lintText(code, {
      filePath: join(cwd, 'test', 'density.test.tsx'),
    });
    const ids = result.messages.map((m) => m.ruleId ?? m.message);
    assert.ok(!ids.includes('shifa/no-physical-direction'), ids.join(', '));
    assert.ok(!ids.includes('shifa/no-hardcoded-design-values'), ids.join(', '));
    assert.ok(ids.includes('shifa/no-ui-sdk-agent'), ids.join(', '));
  });

  it('checks gap-x and gap-y steps, which stopped at `gap` before', async () => {
    const cwd = join(root, 'packages', 'ui');
    const [result] = await new ESLint({ cwd }).lintText(
      "export const a = cn('gap-x-14', 'gap-y-0.5');\ndeclare function cn(...c: string[]): string;\n",
      { filePath: join(cwd, 'src', 'index.ts') },
    );
    const steps = result.messages.filter((m) => m.ruleId === 'shifa/no-hardcoded-design-values');
    assert.equal(steps.length, 1, steps.map((m) => m.message).join('\n'));
    assert.match(steps[0]?.message ?? '', /gap-x-14/);
  });
});
