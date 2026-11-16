// The shared stylesheet: one template set for browser printing, server PDFs and thermal images.
// Conventions (kept for Phase A, ADR-0034): dir="rtl" lang="ar" on <html>; one font family with
// no generic fallback (a missing glyph shows as a fallback font in pdffonts, never hidden);
// Latin runs in <bdi dir="ltr">; tabular digits; sizes in pt/mm so print and raster agree.
import { TEMPLATE_FAMILY } from '../fonts.ts';

export const BASE_CSS = `
html { font-family: '${TEMPLATE_FAMILY}'; font-size: var(--base, 10pt); line-height: 1.5; color: #000; }
body { margin: 0; }
* { box-sizing: border-box; }
bdi[dir="ltr"] { unicode-bidi: isolate; direction: ltr; }
.num, td.num, th.num { font-variant-numeric: tabular-nums; }
h1 { font-size: 1.5rem; margin: 0 0 1mm; }
h2 { font-size: 1.15rem; margin: 0; }
.muted { font-size: 0.85rem; }
.row { display: flex; justify-content: space-between; gap: 2mm; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { text-align: start; padding: 0.6mm 1mm; vertical-align: top; }
hr { border: 0; border-top: 0.3mm solid #000; margin: 1.5mm 0; }
`;

/** Roll paper (receipt, ticket): no CSS page size; Gotenberg prints one page as tall as the
 * content, and the printable width is the body width (72 mm on 80 mm paper, 48 mm on 58 mm). */
export const rollCss = (printableMm: number, baseSize: string) => `
:root { --base: ${baseSize}; }
@page { margin: 0; }
body { width: ${String(printableMm)}mm; margin: 0 auto; padding: 2mm 0 0; }
/* Tear-off margin, and slack for Gotenberg singlePage: it sizes the page to the measured content
   height, Chromium print layout can need a pixel more, and what spills to a second page is
   dropped. Only this empty block can spill (report §2). */
.tear-off { height: 10mm; }
.center { text-align: center; }
.big { font-size: 3.2rem; font-weight: 700; line-height: 1.1; }
.total { font-weight: 700; font-size: 1.15rem; }
`;

/** Thermal raster: the same page scaled so CSS mm become printer dots (203 dpi). */
export const THERMAL_ZOOM = 203 / 96;
export const thermalCss = `html { zoom: ${THERMAL_ZOOM.toFixed(4)}; background: #fff; }`;

export function page(css: string, body: string, title: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="fonts.css">
<style>${BASE_CSS}${css}</style>
</head>
<body>${body}</body>
</html>`;
}
