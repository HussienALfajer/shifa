// Criterion 1: Gotenberg is pinned by version and digest, and no render reaches the network.
import { describe, expect, it } from 'vitest';
import { DIGIT_STYLES } from '../src/digits.ts';
import { GOTENBERG_IMAGE } from '../src/gotenberg.ts';
import { DOCUMENTS, renderInput } from '../src/templates/index.ts';
import { useStack } from './stack.ts';

const stack = useStack();

describe('Gotenberg harness', () => {
  it('pins the image by 8.x version and sha256 digest', () => {
    expect(GOTENBERG_IMAGE).toMatch(/^gotenberg\/gotenberg:8\.\d+\.\d+@sha256:[0-9a-f]{64}$/);
  });

  it('runs the pinned version', async () => {
    const pinned = /:(8\.\d+\.\d+)@/.exec(GOTENBERG_IMAGE)?.[1];
    expect(await stack.gotenberg.version()).toBe(pinned);
  });

  it('renders every document in both digit styles without a request to the canary', async () => {
    for (const doc of DOCUMENTS) {
      for (const digits of DIGIT_STYLES) {
        const pdf = await stack.gotenberg.renderPdf(renderInput(doc.id, digits));
        expect(pdf.byteLength, doc.id).toBeGreaterThan(1000);
      }
    }
    expect(await stack.canary.requests()).toBe(0);
  });

  it('blocks a probe page that points at the canary (allow-list)', async () => {
    const probe = {
      html: `<!doctype html><html lang="ar" dir="rtl"><body><p>اختبار</p>
        <img src="${stack.canary.url}/pixel.png"><link rel="stylesheet" href="${stack.canary.url}/x.css">
        <script>fetch('${stack.canary.url}/fetch').catch(() => {});</script></body></html>`,
      assets: [],
    };
    await stack.gotenberg.renderPdf(probe).catch(() => undefined);
    expect(await stack.canary.requests()).toBe(0);
    // Control: the canary answers and counts a request sent to its network alias, so 0 above
    // means "blocked", not "down".
    expect(await stack.canary.selfCheck()).toBe(true);
    expect(await stack.canary.requests()).toBe(1);
  });

  it('logs document type, byte size and timings only', () => {
    expect(stack.gotenberg.log.length).toBeGreaterThan(0);
    for (const entry of stack.gotenberg.log) {
      expect(Object.keys(entry).sort()).toEqual(['bytes', 'doc', 'ms', 'op', 'status']);
    }
    expect(JSON.stringify(stack.gotenberg.log)).not.toMatch(/[؀-ۿ]/);
  });
});
