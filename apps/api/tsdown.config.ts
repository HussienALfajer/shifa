// Builds dist/main.js, runnable with plain `node` (no TypeScript loader). Nest needs legacy
// decorators with type metadata, which Node's type stripping cannot run, so the API is bundled
// (Oxc transform, reading experimentalDecorators/emitDecoratorMetadata from tsconfig.json).
// Workspace packages export .ts source and are bundled in; npm dependencies stay external and
// resolve from apps/api/node_modules (so every package the bundle imports is a dependency here).
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  tsconfig: 'tsconfig.json',
  // package.json is "type": "module", so plain .js is ESM.
  outExtensions: () => ({ js: '.js' }),
  deps: { alwaysBundle: [/^@shifa\//] },
});
