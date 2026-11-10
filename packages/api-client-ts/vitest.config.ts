import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // test/*.test-d.ts are type-level tests: tsc checks them, Vitest reports them.
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
  },
});
