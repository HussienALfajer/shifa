// `fonts:sheet`: the prescription (A5, PDF page) and the 58 mm receipt (thermal image) in each
// candidate font, plus the 58 mm receipt at a second, larger size, written to
// `.verify/s3/fonts/` for the owner's font and size choice. Needs Docker.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startCanary } from '../src/canary.ts';
import { FONT_IDS } from '../src/fonts.ts';
import { VERIFY_DIR } from '../src/golden.ts';
import { startGotenberg } from '../src/gotenberg.ts';
import { startNetwork } from '../src/network.ts';
import { startPdfTools } from '../src/pdf-tools.ts';
import { renderInput, renderThermalInput } from '../src/templates/index.ts';
import { bitmapToPng, pngToBitmap } from '../src/thermal.ts';

const OUT = join(VERIFY_DIR, 'fonts');
await mkdir(OUT, { recursive: true });
const network = await startNetwork();
const [gotenberg, canary, pdf] = await Promise.all([
  startGotenberg(network),
  startCanary(network),
  startPdfTools(),
]);
try {
  for (const font of FONT_IDS) {
    const pages = await pdf.rasterise(
      await gotenberg.renderPdf(renderInput('prescription-a5', 'arab', font)),
    );
    if (pages[0]) await writeFile(join(OUT, `${font}-prescription-a5.png`), pages[0]);
    for (const [label, size] of [
      ['9pt', undefined],
      ['11pt', '11pt'],
    ] as const) {
      const input = renderThermalInput('receipt-58', 'arab', font);
      const html = size ? input.html.replace('--base: 9pt', `--base: ${size}`) : input.html;
      const shot = await gotenberg.screenshot({ ...input, html }, 384);
      await writeFile(
        join(OUT, `${font}-receipt-58-${label}.png`),
        bitmapToPng(pngToBitmap(shot, 'threshold')),
      );
    }
  }
  if ((await canary.requests()) !== 0) throw new Error('a render reached the canary');
  process.stdout.write(`fonts:sheet: wrote ${String(FONT_IDS.length * 3)} images to ${OUT}\n`);
} finally {
  await Promise.allSettled([gotenberg.stop(), canary.stop(), pdf.stop()]);
  await network.stop();
}
