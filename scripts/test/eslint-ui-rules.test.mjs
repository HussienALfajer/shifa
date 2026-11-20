// Spec 0.4 criterion 6 (slice 0.4-03): lint fails on physical left/right utilities and CSS
// properties, hard-coded colours, spacing and fonts, any @ui-sdk/* or Base UI import outside
// packages/ui, and any import of the UI SDK agent bridge. RuleTester cases, the fixtures, and
// the rules as the real package configs run them.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ESLint, RuleTester } from 'eslint';
import { createConfig, spacingSteps } from '../../tooling/eslint-config/index.js';
import { noHardcodedDesignValuesRule } from '../../tooling/eslint-config/rules/no-hardcoded-design-values.js';
import {
  noPhysicalDirectionRule,
  physicalClass,
  physicalCssProperty,
} from '../../tooling/eslint-config/rules/no-physical-direction.js';
import { shifaPlugin } from '../../tooling/eslint-config/rules/plugin.js';
import {
  isAgentBridge,
  noUiSdkAgentRule,
  uiSdkOnlyInUiRule,
} from '../../tooling/eslint-config/rules/ui-sdk-imports.js';

const root = join(import.meta.dirname, '..', '..');
const uiRoot = join(root, 'packages', 'ui');
const fixtures = join(import.meta.dirname, 'fixtures', 'eslint-ui');

const parser = createConfig({ tsconfigRootDir: root }).find((c) => c.languageOptions?.parser)
  ?.languageOptions.parser;
assert.ok(parser, 'the shared config must set a parser');

const tester = new RuleTester({
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

/** The spacing steps of the token theme, as Tailwind names them. */
const SPACING = [
  '0',
  '0.5',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '16',
];
const spacingOptions = [{ spacing: SPACING }];
const uiOptions = [{ uiRoot }];

const bad = (code, messageId, count = 1, extra = {}) => ({
  code,
  errors: Array.from({ length: count }, () => ({ messageId })),
  ...extra,
});

describe('spacing steps', () => {
  it('come from the generated Tailwind theme of @shifa/tokens', () => {
    assert.deepEqual([...spacingSteps()].sort(), [...SPACING].sort());
  });
});

describe('no-physical-direction', () => {
  it('knows the physical utilities and their logical equivalents', () => {
    for (const cls of [
      'ml-2',
      'mr-4',
      'pl-3',
      'pr-0.5',
      '-ml-2',
      'hover:mr-2',
      'md:!pl-4',
      'left-0',
      'right-4',
      'text-left',
      'text-right',
      'rounded-l-md',
      'rounded-tr-sm',
      'rounded-br',
      'border-l',
      'border-r-2',
      'float-left',
      'scroll-ml-2',
      'origin-top-left',
    ]) {
      assert.ok(physicalClass(cls), `${cls} is physical`);
    }
    for (const cls of [
      'ms-2',
      'me-4',
      'ps-3',
      'pe-0.5',
      'start-0',
      'end-4',
      'text-start',
      'text-end',
      'rounded-s-md',
      'rounded-se-sm',
      'border-s',
      'float-start',
      'mx-auto',
      'px-4',
      'inset-x-0',
      'text-text-muted',
      'bg-bg-surface',
    ]) {
      assert.equal(physicalClass(cls), null, `${cls} is logical or direction-free`);
    }
  });

  it('knows the physical CSS properties', () => {
    for (const [name, value] of [
      ['left', 0],
      ['right', '4px'],
      ['marginLeft', 8],
      ['margin-left', '8px'],
      ['paddingRight', 4],
      ['borderLeftWidth', 1],
      ['borderTopLeftRadius', 4],
      ['textAlign', 'left'],
      ['float', 'right'],
    ]) {
      assert.ok(physicalCssProperty(name, value), `${name}: ${value} is physical`);
    }
    for (const [name, value] of [
      ['insetInlineStart', 0],
      ['marginInlineEnd', 8],
      ['margin-inline-start', '8px'],
      ['textAlign', 'start'],
      ['top', 0],
      ['borderStartStartRadius', 4],
    ]) {
      assert.equal(physicalCssProperty(name, value), null, `${name}: ${value} is logical`);
    }
  });

  it('runs the RuleTester cases', () => {
    tester.run('no-physical-direction', noPhysicalDirectionRule, {
      valid: [
        'export const a = <div className="ms-2 pe-4 text-start rounded-s-md" />;',
        "export const b = cn('ms-2', isOpen && 'end-0');",
        "export const c = cva('ps-4', { variants: { size: { sm: 'pe-2' } } });",
        'export const d = <div style={{ marginInlineStart: 8, insetInlineEnd: 0 }} />;',
        // Ordinary strings outside class names and styles are not class lists.
        "export const e = 'press the left-arrow key';",
        'export const f = { left: node, right: other };',
      ],
      invalid: [
        bad('export const a = <div className="ml-2 text-left" />;', 'physicalClass', 2),
        bad("export const b = cn('pl-4', isOpen && 'right-0');", 'physicalClass', 2),
        bad(
          "export const c = cva('ps-4', { variants: { size: { sm: 'mr-2' } } });",
          'physicalClass',
        ),
        bad('export const d = <div className={`flex ${x} -ml-1`} />;', 'physicalClass'),
        bad("export const e = clsx(['rounded-l-md']);", 'physicalClass'),
        bad('export const f = <div style={{ marginLeft: 8 }} />;', 'physicalProperty'),
        bad(
          "export const g = <div style={{ textAlign: 'right', left: 0 }} />;",
          'physicalProperty',
          2,
        ),
        bad("export const h = <div style={{ 'padding-left': '4px' }} />;", 'physicalProperty'),
      ],
    });
  });
});

describe('no-hardcoded-design-values', () => {
  it('runs the RuleTester cases', () => {
    tester.run('no-hardcoded-design-values', noHardcodedDesignValuesRule, {
      valid: [
        {
          code: 'export const a = <div className="p-4 gap-0.5 ms-16 bg-bg-surface text-text-default" />;',
          options: spacingOptions,
        },
        {
          code: "export const b = cn('w-full h-auto w-1/2 min-h-screen size-px', 'shadow-card font-sans');",
          options: spacingOptions,
        },
        {
          code: "export const c = cn('h-(--shifa-button-height)', 'px-[var(--shifa-button-padding-inline)]');",
          options: spacingOptions,
        },
        // The sizes UI SDK measures for a popup at run time are not design values.
        {
          code: "export const c2 = cn('min-w-(--anchor-width)', 'max-h-(--available-height)');",
          options: spacingOptions,
        },
        {
          code: "export const d = <div style={{ color: 'var(--shifa-color-text-default)', padding: 0 }} />;",
          options: spacingOptions,
        },
        // Hex strings outside class names and styles (a contrast test) are not design values.
        { code: "export const e = contrastRatio('#000000', '#FFFFFF');", options: spacingOptions },
      ],
      invalid: [
        // Spacing steps that are not tokens.
        bad('export const a = <div className="p-14" />;', 'spacingStep', 1, {
          options: spacingOptions,
        }),
        bad("export const b = cn('gap-2.5', 'ms-15', '-mt-14');", 'spacingStep', 3, {
          options: spacingOptions,
        }),
        bad("export const c = cn('p-px', 'space-y-7.5');", 'spacingStep', 2, {
          options: spacingOptions,
        }),
        // Arbitrary values.
        bad("export const d = cn('p-[13px]', 'w-[200px]', 'top-[3rem]');", 'arbitraryValue', 3, {
          options: spacingOptions,
        }),
        bad("export const e = cn('[margin:3px]');", 'arbitraryValue', 1, {
          options: spacingOptions,
        }),
        // Colours.
        bad("export const f = cn('bg-[#fff]', 'text-[rgb(0,0,0)]');", 'arbitraryValue', 2, {
          options: spacingOptions,
        }),
        bad("export const g = <div style={{ color: '#1f6f5c' }} />;", 'hardcodedColor', 1, {
          options: spacingOptions,
        }),
        bad(
          "export const h = <div style={{ background: 'hsl(160 50% 30%)', borderColor: 'rgba(0,0,0,.1)' }} />;",
          'hardcodedColor',
          2,
          { options: spacingOptions },
        ),
        // Fonts and lengths in styles.
        bad('export const i = cn("font-[\'Inter\']");', 'arbitraryValue', 1, {
          options: spacingOptions,
        }),
        bad("export const j = <div style={{ fontFamily: 'Arial' }} />;", 'hardcodedFont', 1, {
          options: spacingOptions,
        }),
        bad(
          "export const k = <div style={{ padding: '13px', marginBlock: 4, fontSize: '15px' }} />;",
          'hardcodedLength',
          3,
          { options: spacingOptions },
        ),
      ],
    });
  });
});

describe('ui-sdk-only-in-ui and no-ui-sdk-agent', () => {
  const outside = join(root, 'apps', 'web', 'src', 'page.tsx');
  const inside = join(uiRoot, 'src', 'button', 'button.tsx');

  it('know the agent bridge entry points', () => {
    for (const s of [
      '@ui-sdk/react/agent',
      '@ui-sdk/react/agent/x',
      '@ui-sdk/core/agent',
      '@ui-sdk/agent',
    ]) {
      assert.ok(isAgentBridge(s), s);
    }
    for (const s of [
      '@ui-sdk/react',
      '@ui-sdk/react/button',
      '@ui-sdk/react/agents-guide',
      'agent',
    ]) {
      assert.equal(isAgentBridge(s), false, s);
    }
  });

  it('runs the RuleTester cases', () => {
    const at = (filename, code, messageId, count = 1) => ({
      filename,
      code,
      options: uiOptions,
      ...(messageId ? { errors: Array.from({ length: count }, () => ({ messageId })) } : {}),
    });
    tester.run('ui-sdk-only-in-ui', uiSdkOnlyInUiRule, {
      valid: [
        at(inside, "import { Button } from '@ui-sdk/react/button';\nexport { Button };"),
        at(inside, "import { Menu } from '@base-ui/react/menu';\nexport { Menu };"),
        at(outside, "import { Button } from '@shifa/ui';\nexport { Button };"),
      ],
      invalid: [
        at(
          outside,
          "import { Button } from '@ui-sdk/react/button';\nexport { Button };",
          'outsideUi',
        ),
        at(outside, "export * from '@ui-sdk/core';", 'outsideUi'),
        at(outside, "export const m = await import('@base-ui/react');", 'outsideUi'),
        at(
          outside,
          "import { Menu } from '@base-ui-components/react/menu';\nexport { Menu };",
          'outsideUi',
        ),
        at(outside, "const x = require('@ui-sdk/react');\nexport { x };", 'outsideUi'),
        at(
          join(root, 'packages', 'ui-extra', 'x.ts'),
          "export * from '@ui-sdk/react';",
          'outsideUi',
        ),
      ],
    });
    tester.run('no-ui-sdk-agent', noUiSdkAgentRule, {
      valid: [{ filename: inside, code: "export * from '@ui-sdk/react/button';" }],
      invalid: [
        {
          filename: inside,
          code: "import { bridge } from '@ui-sdk/react/agent';\nexport { bridge };",
          errors: [{ messageId: 'agentBridge' }],
        },
        {
          filename: outside,
          code: "export const a = await import('@ui-sdk/react/agent');",
          errors: [{ messageId: 'agentBridge' }],
        },
        {
          filename: inside,
          code: "export type A = typeof import('@ui-sdk/react/agent');",
          errors: [{ messageId: 'agentBridge' }],
        },
      ],
    });
  });
});

/** Messages of `ruleId` when a fixture is linted with the plugin and that rule alone. */
async function fixtureErrors(file, ruleId, options) {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.tsx'],
        languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { shifa: shifaPlugin },
        rules: { [ruleId]: ['error', ...options] },
      },
    ],
  });
  const [result] = await eslint.lintFiles([join(fixtures, file)]);
  return result.messages.filter((m) => m.ruleId === ruleId);
}

describe('fixtures', () => {
  const cases = [
    ['shifa/no-physical-direction', 'physical', []],
    ['shifa/no-hardcoded-design-values', 'hardcoded', spacingOptions],
  ];
  for (const [ruleId, stem, options] of cases) {
    it(`${ruleId} fails ${stem}.bad.tsx and passes ${stem}.good.tsx`, async () => {
      const failing = await fixtureErrors(`${stem}.bad.tsx`, ruleId, options);
      assert.ok(failing.length >= 5, `${stem}.bad.tsx: only ${failing.length} errors`);
      assert.deepEqual(await fixtureErrors(`${stem}.good.tsx`, ruleId, options), []);
    });
  }
});

/** Rule messages when `code` is linted as the existing file `rel` of `pkg` with its real config. */
async function realMessages(pkg, rel, code) {
  const cwd = join(root, pkg);
  const filePath = join(cwd, rel);
  assert.ok(existsSync(filePath), `${filePath} must exist for a real lint run`);
  const [result] = await new ESLint({ cwd }).lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId);
}

describe('real package configs', () => {
  const sdk = "import { Button } from '@ui-sdk/react/button';\nexport { Button };\n";
  const agent = "import { connect } from '@ui-sdk/react/agent';\nexport { connect };\n";

  it('refuse @ui-sdk/* outside packages/ui and allow it inside', async () => {
    assert.ok(
      (await realMessages('packages/testing', 'src/index.ts', sdk)).includes(
        'shifa/ui-sdk-only-in-ui',
      ),
    );
    assert.ok(
      !(await realMessages('packages/ui', 'src/index.ts', sdk)).includes('shifa/ui-sdk-only-in-ui'),
    );
  });

  it('refuse the agent bridge everywhere, packages/ui included', async () => {
    assert.ok(
      (await realMessages('packages/ui', 'src/index.ts', agent)).includes('shifa/no-ui-sdk-agent'),
    );
    assert.ok(
      (await realMessages('packages/testing', 'src/index.ts', agent)).includes(
        'shifa/no-ui-sdk-agent',
      ),
    );
  });

  it('run the class-name rules in every package', async () => {
    const code =
      "export const a = cn('ml-2', 'p-14');\ndeclare function cn(...c: string[]): string;\n";
    const ids = await realMessages('packages/ui', 'src/index.ts', code);
    assert.ok(ids.includes('shifa/no-physical-direction'), ids.join(', '));
    assert.ok(ids.includes('shifa/no-hardcoded-design-values'), ids.join(', '));
  });

  it('refuse @ui-sdk/* in the repository scripts too', async () => {
    const [result] = await new ESLint({ cwd: root }).lintText(sdk, {
      filePath: join(root, 'scripts', 'verify.mjs'),
    });
    assert.ok(result.messages.some((m) => m.ruleId === 'shifa/ui-sdk-only-in-ui'));
  });
});
