import { createConfig } from '@shifa/eslint-config';

export default [
  // The design system's files, rebuilt by `pnpm design-system:build` (git-ignored).
  { ignores: ['design-system/**'] },
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
];
