// Slice A-01-06 review: the apps mount pages drawn in packages/web-shell, so a raw button there is
// refused like one under apps/; other packages (packages/ui builds Button) stay exempt.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { createConfig } from '../../tooling/eslint-config/index.js';
import { noRawButtonRule } from '../../tooling/eslint-config/rules/no-raw-button.js';

const root = join(import.meta.dirname, '..', '..');
const options = [{ appsRoot: join(root, 'apps') }];
const parser = createConfig({ tsconfigRootDir: root }).find((c) => c.languageOptions?.parser)
  ?.languageOptions.parser;
assert.ok(parser, 'the shared config must set a parser');
const tester = new RuleTester({
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

describe('shifa/no-raw-button in the web shell', () => {
  it('refuses a raw button in packages/web-shell, not in another package', () => {
    tester.run('no-raw-button', noRawButtonRule, {
      valid: [
        {
          code: 'const a = <button type="button">x</button>;',
          filename: join(root, 'packages', 'testing', 'src', 'x.tsx'),
          options,
        },
        {
          code: 'const a = <button type="button">x</button>;',
          filename: join(root, 'packages', 'web-shell-other', 'src', 'x.tsx'),
          options,
        },
      ],
      invalid: [
        {
          code: 'const a = <button type="button">x</button>;',
          filename: join(root, 'packages', 'web-shell', 'src', 'pages.tsx'),
          options,
          errors: [{ messageId: 'rawButton' }],
        },
      ],
    });
  });
});
