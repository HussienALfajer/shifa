// Slice A-01-06 (backlog 0.4-03): app code never draws its own button. `<button>` and
// `role="button"` on another element are refused under apps/, pointing to Button from @shifa/ui;
// packages/ui (which builds Button) and every other package are exempt.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { createConfig } from '../../tooling/eslint-config/index.js';
import { noRawButtonRule } from '../../tooling/eslint-config/rules/no-raw-button.js';

const root = join(import.meta.dirname, '..', '..');
const appsRoot = join(root, 'apps');
const inApp = join(appsRoot, 'clinic-web', 'src', 'page.tsx');
const inUi = join(root, 'packages', 'ui', 'src', 'button', 'button.tsx');

const parser = createConfig({ tsconfigRootDir: root }).find((c) => c.languageOptions?.parser)
  ?.languageOptions.parser;
assert.ok(parser, 'the shared config must set a parser');

const tester = new RuleTester({
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});
const options = [{ appsRoot }];

describe('shifa/no-raw-button', () => {
  it('refuses raw buttons in app code and allows them elsewhere', () => {
    tester.run('no-raw-button', noRawButtonRule, {
      valid: [
        { code: 'const a = <Button>حفظ</Button>;', filename: inApp, options },
        { code: 'const a = <div role="dialog" />;', filename: inApp, options },
        { code: 'const a = <button type="button">x</button>;', filename: inUi, options },
        { code: 'const a = <div role="button" />;', filename: inUi, options },
        { code: 'const a = <ui.button />;', filename: inApp, options },
      ],
      invalid: [
        {
          code: 'const a = <button type="button">x</button>;',
          filename: inApp,
          options,
          errors: [{ messageId: 'rawButton' }],
        },
        {
          code: 'const a = <span role="button" tabIndex={0} />;',
          filename: inApp,
          options,
          errors: [{ messageId: 'roleButton' }],
        },
        {
          code: "const a = <a role={'button'} href='#' />;",
          filename: inApp,
          options,
          errors: [{ messageId: 'roleButton' }],
        },
        {
          code: 'const a = <div role={`button`} />;',
          filename: inApp,
          options,
          errors: [{ messageId: 'roleButton' }],
        },
      ],
    });
  });

  it('is on in the shared config for every file', () => {
    const rules = createConfig({ tsconfigRootDir: root }).flatMap((c) =>
      Object.entries(c.rules ?? {}),
    );
    const entry = rules.find(([name]) => name === 'shifa/no-raw-button');
    assert.ok(entry, 'shifa/no-raw-button is configured');
    assert.deepEqual(entry[1], ['error', { appsRoot }]);
  });
});
