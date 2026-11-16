// Browser printing (criterion 5): the same HTML and font files, written to a temp folder and
// printed by Playwright's Chromium (`page.pdf`, CSS page size preferred). Network is blocked:
// only file:// requests inside that folder are allowed.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Browser, chromium } from 'playwright';
import type { RenderInput } from './gotenberg.ts';
import type { DocumentSpec } from './templates/index.ts';

export interface BrowserPrinter {
  version: string;
  print(input: RenderInput, doc: DocumentSpec): Promise<Uint8Array>;
  close(): Promise<void>;
}

export async function startBrowserPrinter(): Promise<BrowserPrinter> {
  const browser: Browser = await chromium.launch();
  return {
    version: browser.version(),
    print: async (input, doc) => {
      const dir = await mkdtemp(join(tmpdir(), 's3-print-'));
      try {
        await writeFile(join(dir, 'index.html'), input.html);
        for (const asset of input.assets) await writeFile(join(dir, asset.name), asset.data);
        const page = await browser.newPage();
        const base = pathToFileURL(dir).href;
        await page.route('**/*', (route) =>
          route.request().url().startsWith(base) ? route.continue() : route.abort(),
        );
        await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
        // A string, so this Node package needs no DOM typings.
        await page.evaluate('document.fonts.ready.then(() => undefined)');
        const roll = doc.paper.heightMm === undefined;
        const pdf = await page.pdf({
          printBackground: true,
          preferCSSPageSize: !roll,
          // Roll paper: the printer driver gives the width; a tall page keeps it on one page.
          ...(roll
            ? {
                width: `${String(doc.paper.widthMm)}mm`,
                height: '3000mm',
                margin: { top: '0', bottom: '0', left: '0', right: '0' },
              }
            : {}),
        });
        await page.close();
        return new Uint8Array(pdf);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    close: () => browser.close(),
  };
}
