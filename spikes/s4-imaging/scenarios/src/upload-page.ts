// Driver for the throwaway upload page (`/upload/` on the gateway) in the clinic-side browser.
// The test plays the application: it hands the page fresh uploader tokens (s4Token) and
// collects the page's cumulative statistics (s4Report), which survive a reload here only.
import type { Stack } from '@shifa-spike/s4-stack';
import { type Browser, chromium, type Page } from 'playwright';

export type UploadMode = 'chunked' | 'stow';

/** What the page reports after every request, cumulative for one page load. */
export interface PageStats {
  mode: UploadMode;
  /** Request body bytes put on the wire, including attempts that failed. */
  sentBytes: number;
  /** Bytes the server acknowledged (chunk PUTs answered 200, STOW parts stored). */
  ackedBytes: number;
  /** Bytes the server already had when this page load started (resume). */
  resumedBytes: number;
  /** Paths of files with at least one failed or refused request. */
  interrupted: string[];
  /** Paths skipped: not referenced by the DICOMDIR, not DICOM, or refused by the server. */
  skipped: string[];
  files: number;
  chunkSize: number;
  outcome: 'running' | 'done' | 'failed';
  ms: number;
}

export interface UploadPage {
  page: Page;
  /** Last report of each page load, in order (a reload starts a new entry). */
  loads: PageStats[];
}

/**
 * Chromium on the clinic network. The gateway is plain HTTP inside the spike, so its origin is
 * marked trustworthy for this browser only: the viewer session cookie is `Secure`, which
 * Chromium otherwise refuses from an http origin. WebGL (OHIF's MPR) runs on SwiftShader.
 */
export async function connectBrowser(stack: Stack): Promise<Browser> {
  const endpoint = stack.browser?.wsEndpoint;
  if (!endpoint) throw new Error('browser container not started');
  const args = [
    `--unsafely-treat-insecure-origin-as-secure=${stack.clinicGatewayUrl}`,
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
  ];
  return chromium.connect(endpoint, {
    timeout: 120_000,
    headers: { 'x-playwright-launch-options': JSON.stringify({ args }) },
  });
}

export async function openUploadPage(
  browser: Browser,
  stack: Stack,
  options: { tenant: 'a' | 'b'; mode: UploadMode; chunkSize?: number },
): Promise<UploadPage> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const loads: PageStats[] = [];
  let loadIndex = -1;
  page.on('load', () => {
    loadIndex += 1;
  });
  await page.exposeFunction('s4Token', () =>
    stack.token({ sub: `uploader-${options.tenant}`, tenant: options.tenant, role: 'uploader' }),
  );
  await page.exposeFunction('s4Report', (stats: PageStats) => {
    loads[Math.max(loadIndex, 0)] = stats;
  });
  const query = new URLSearchParams({ mode: options.mode });
  if (options.chunkSize) query.set('chunk', String(options.chunkSize));
  await page.goto(`${stack.clinicGatewayUrl}/upload/?${query.toString()}`, { timeout: 300_000 });
  return { page, loads };
}

/** Selects the study folder (webkitdirectory input) and starts the upload. */
export async function selectAndStart(page: Page, dir: string): Promise<void> {
  await page.locator('#folder').setInputFiles(dir, { timeout: 600_000 });
  await page.locator('#start').click();
}

export async function waitOutcome(page: Page, timeoutMs: number): Promise<'done' | 'failed'> {
  await page.waitForSelector('#status[data-state="done"], #status[data-state="failed"]', {
    timeout: timeoutMs,
  });
  return (await page.locator('#status').getAttribute('data-state')) as 'done' | 'failed';
}

/** Totals over every page load of one upload. */
export function totals(loads: readonly PageStats[]) {
  return {
    sentBytes: loads.reduce((n, s) => n + s.sentBytes, 0),
    ackedBytes: loads.reduce((n, s) => n + s.ackedBytes, 0),
    interrupted: [...new Set(loads.flatMap((s) => s.interrupted))],
    resumedBytes: loads.at(-1)?.resumedBytes ?? 0,
  };
}
