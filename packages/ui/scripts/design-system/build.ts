// pnpm design-system:build — rebuilds every file of the Shifa Design System from the repository
// into packages/ui/design-system/project/ (git-ignored), the folder the sync publishes
// (docs/process/ui-screenshots.md, "Syncing the design system"). Nothing here talks to the network.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { assembleDesignSystem } from './assemble.ts';
import { buildBundle } from './bundle.ts';

const out = join(import.meta.dirname, '..', '..', 'design-system', 'project');
rmSync(out, { recursive: true, force: true });
await assembleDesignSystem(out);
await buildBundle(out);
process.stdout.write(`design-system: written to ${out}\n`);
