// `goldens:update`: renders every document and thermal image and writes them as CANDIDATES to
// `.verify/s3/candidates/` (never into goldens/). Copying a candidate into goldens/ is a manual
// step after the owner's eye check (recorded in the slice file). Needs Docker.
import { startCanary } from '../src/canary.ts';
import { DIGIT_STYLES } from '../src/digits.ts';
import { writeCandidate } from '../src/golden.ts';
import { startGotenberg } from '../src/gotenberg.ts';
import { startNetwork } from '../src/network.ts';
import { startPdfTools } from '../src/pdf-tools.ts';
import { DOCUMENTS, renderInput, renderThermalInput } from '../src/templates/index.ts';
import { bitmapToPng, DITHER_MODES, pngToBitmap } from '../src/thermal.ts';

const network = await startNetwork();
const [gotenberg, canary, pdf] = await Promise.all([
  startGotenberg(network),
  startCanary(network),
  startPdfTools(),
]);
let written = 0;
try {
  for (const doc of DOCUMENTS) {
    for (const digits of DIGIT_STYLES) {
      const pages = await pdf.rasterise(await gotenberg.renderPdf(renderInput(doc.id, digits)));
      for (const [index, png] of pages.entries()) {
        await writeCandidate(`pdf/${doc.id}-${digits}-p${String(index + 1)}.png`, png);
        written += 1;
      }
      if (doc.thermalWidthPx !== undefined) {
        const shot = await gotenberg.screenshot(
          renderThermalInput(doc.id, digits),
          doc.thermalWidthPx,
        );
        for (const mode of DITHER_MODES) {
          await writeCandidate(
            `thermal/${doc.id}-${digits}-${mode}.png`,
            bitmapToPng(pngToBitmap(shot, mode)),
          );
          written += 1;
        }
      }
    }
  }
  if ((await canary.requests()) !== 0) throw new Error('a render reached the canary');
  process.stdout.write(
    `goldens:update: wrote ${String(written)} candidates to .verify/s3/candidates/\n`,
  );
} finally {
  await Promise.allSettled([gotenberg.stop(), canary.stop(), pdf.stop()]);
  await network.stop();
}
