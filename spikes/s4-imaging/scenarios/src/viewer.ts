// OHIF in the clinic-side browser: open a study through the gateway (one-time code → session
// cookie → viewer route) or on the edge LAN, then wait until viewports show image pixels.
// "Rendered" = a viewport canvas with non-background pixels (Cornerstone copies its WebGL output
// into a 2D canvas per viewport).
import { randomUUID } from 'node:crypto';
import type { Stack } from '@shifa-spike/s4-stack';
import type { Page } from 'playwright';

export interface OpenOptions {
  studyUid: string;
  mpr: boolean;
  /** Through the gateway (tenant's session) or straight to the edge box's OHIF on the LAN. */
  via: { gateway: 'a' | 'b' } | { edge: true };
}

/** Navigates to the study; returns the performance.now() origin of the navigation. */
export async function openViewer(page: Page, stack: Stack, options: OpenOptions): Promise<number> {
  const query = new URLSearchParams({ StudyInstanceUIDs: options.studyUid });
  if (options.mpr) query.set('hangingProtocolId', 'mpr');
  let base: string;
  if ('gateway' in options.via) {
    const tenant = options.via.gateway;
    const code = await stack.token({
      sub: `viewer-${tenant}`,
      tenant,
      role: 'viewer',
      typ: 'viewer-code',
      jti: randomUUID(),
      ttlSeconds: 60,
    });
    const session = await page.goto(
      `${stack.clinicGatewayUrl}/viewer/session?code=${encodeURIComponent(code)}`,
      { timeout: 120_000 },
    );
    if (!session || session.status() >= 400) throw new Error('viewer session refused');
    base = `${stack.clinicGatewayUrl}/viewer`;
  } else {
    const url = stack.edge?.clinicViewerUrl;
    if (!url) throw new Error('edge viewer not started');
    base = url;
  }
  const start = Date.now();
  await page.goto(`${base}/viewer?${query.toString()}`, { timeout: 600_000 });
  return start;
}

/** Waits until at least `count` viewport canvases hold non-background pixels. */
async function rendered(page: Page, count: number, timeoutMs: number): Promise<void> {
  await page.waitForFunction(
    (needed: number) => {
      const canvases = [...document.querySelectorAll('canvas.cornerstone-canvas')];
      const painted = canvases.filter((node) => {
        const canvas = node as HTMLCanvasElement;
        if (canvas.width === 0 || canvas.height === 0) return false;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return false;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let bright = 0;
        for (let i = 0; i < data.length; i += 16) if ((data[i] ?? 0) > 24) bright += 1;
        return bright > 200;
      });
      return painted.length >= needed;
    },
    count,
    { timeout: timeoutMs, polling: 1000 },
  );
}

/** Milliseconds from `start` until the first viewport shows the image. */
export async function firstImage(page: Page, start: number, timeoutMs: number): Promise<number> {
  await rendered(page, 1, timeoutMs);
  return Date.now() - start;
}

/** Milliseconds from `start` until the three MPR viewports show the volume. */
export async function mprReady(page: Page, start: number, timeoutMs: number): Promise<number> {
  await rendered(page, 3, timeoutMs);
  return Date.now() - start;
}
