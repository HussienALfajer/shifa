// Bundles scripts/generate-openapi.ts for the `openapi` drift check, like tsdown.config.ts does
// for the server. The output sits under node_modules/.cache so npm dependencies resolve from
// apps/api/node_modules and nothing lands in dist/ (which the build step owns).
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { 'generate-openapi': 'scripts/generate-openapi.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'node_modules/.cache/openapi',
  clean: true,
  sourcemap: false,
  dts: false,
  tsconfig: 'tsconfig.json',
  outExtensions: () => ({ js: '.js' }),
  deps: { alwaysBundle: [/^@shifa\//] },
  logLevel: 'error',
});
