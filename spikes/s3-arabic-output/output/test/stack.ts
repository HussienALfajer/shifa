// Per-file test stack: one Docker network with Gotenberg, the canary and poppler (pdf-tools).
// Every render goes through here, so each test file sees the same pinned services.
import { afterAll, beforeAll } from 'vitest';
import { type Canary, startCanary } from '../src/canary.ts';
import { type Gotenberg, startGotenberg } from '../src/gotenberg.ts';
import { startNetwork, type TestNetwork } from '../src/network.ts';
import { type PdfTools, startPdfTools } from '../src/pdf-tools.ts';

export interface Stack {
  network: TestNetwork;
  gotenberg: Gotenberg;
  canary: Canary;
  pdf: PdfTools;
}

export function useStack(): Stack {
  const stack = {} as Stack;
  beforeAll(async () => {
    stack.network = await startNetwork();
    [stack.gotenberg, stack.canary, stack.pdf] = await Promise.all([
      startGotenberg(stack.network),
      startCanary(stack.network),
      startPdfTools(),
    ]);
  });
  afterAll(async () => {
    // A start may have failed part-way: stop whatever exists.
    const started = stack as Partial<Stack>;
    await Promise.allSettled([
      started.gotenberg?.stop(),
      started.canary?.stop(),
      started.pdf?.stop(),
    ]);
    await started.network?.stop();
  });
  return stack;
}

/**
 * Puts extracted and expected text on the same footing, applied to both sides:
 * - whitespace runs collapse to one space;
 * - Arabic marks (tashkeel) are dropped: PDF extraction emits a mark before or after its base
 *   letter depending on glyph positions ("شكًرا" for "شكرًا"); the letters keep their order;
 * - bidi marks (LRM, RLM, ALM) are dropped: invisible, so not in the PDF's text layer;
 * - round brackets become one neutral sign: in RTL the mirrored glyph is extracted as written
 *   on the page (")1(" for "(1)").
 * Everything else (letter order, digits, Latin runs, spacing between words) must match.
 */
export const squash = (text: string): string =>
  text
    .replace(/[\u{064B}-\u{065F}\u{0670}\u{200E}\u{200F}\u{061C}]/gu, '')
    .replace(/[()]/g, '|')
    .replace(/\s+/g, ' ')
    .trim();
