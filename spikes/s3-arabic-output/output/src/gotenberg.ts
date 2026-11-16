// Gotenberg harness (criterion 1). The image is pinned by version and digest (owner,
// 2026-11-16: the last 8.x, 8.40.0, although 9.x exists). Chromium may load file:///tmp/ only:
// HTML and fonts are uploaded with the request, and nothing is ever fetched by URL.
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { TestNetwork } from './network.ts';

export const GOTENBERG_IMAGE =
  'gotenberg/gotenberg:8.40.0@sha256:53073e798c8ef39ea2187e44cb67bab77894ea2509100b94c4fe3b461f7b2996';

export interface Asset {
  name: string;
  data: Uint8Array;
  type: string;
}

export interface RenderInput {
  /** A label for logs only (document type). */
  doc?: string;
  html: string;
  assets: readonly Asset[];
  /** Paper for documents without a CSS page size (roll documents print as one page). */
  roll?: { widthMm: number };
}

/** One log line per call: document type, byte size and timings only (never content). */
export interface LogEntry {
  op: 'pdf' | 'screenshot';
  doc: string;
  status: number;
  bytes: number;
  ms: number;
}

export interface Gotenberg {
  url: string;
  log: LogEntry[];
  version(): Promise<string>;
  renderPdf(input: RenderInput): Promise<Uint8Array>;
  screenshot(input: RenderInput, widthPx: number): Promise<Uint8Array>;
  /** Peak memory of the container in bytes while `work` runs (Docker stats). */
  peakMemory<T>(work: () => Promise<T>): Promise<{ result: T; peakBytes: number }>;
  stop(): Promise<void>;
}

function form(input: RenderInput): FormData {
  const body = new FormData();
  // Print only once the uploaded fonts are in (no fallback metrics or glyphs). Gotenberg skips
  // the network-idle wait by default; nothing here loads from the network anyway.
  body.append('waitForExpression', "document.fonts.status === 'loaded'");
  body.append('files', new Blob([input.html], { type: 'text/html' }), 'index.html');
  for (const asset of input.assets) {
    body.append('files', new Blob([new Uint8Array(asset.data)], { type: asset.type }), asset.name);
  }
  return body;
}

export async function startGotenberg({ network }: TestNetwork): Promise<Gotenberg> {
  const container: StartedTestContainer = await new GenericContainer(GOTENBERG_IMAGE)
    .withNetwork(network)
    .withExposedPorts(3000)
    .withCommand([
      'gotenberg',
      '--chromium-allow-list=^file:///tmp/.*',
      '--chromium-deny-list=^(?!file:///tmp/).*',
      '--api-timeout=60s',
      '--log-level=info',
    ])
    .withWaitStrategy(Wait.forHttp('/health', 3000))
    .start();
  const url = `http://${container.getHost()}:${String(container.getMappedPort(3000))}`;
  const log: LogEntry[] = [];

  async function call(
    op: LogEntry['op'],
    path: string,
    body: FormData,
    doc: string,
  ): Promise<Uint8Array> {
    const start = performance.now();
    const res = await fetch(`${url}${path}`, { method: 'POST', body });
    const bytes = new Uint8Array(await res.arrayBuffer());
    log.push({
      op,
      doc,
      status: res.status,
      bytes: bytes.byteLength,
      ms: Math.round(performance.now() - start),
    });
    // The body of an error is Gotenberg's message, which never holds the document.
    if (!res.ok)
      throw new Error(
        `gotenberg ${op} ${doc}: ${String(res.status)} ${new TextDecoder().decode(bytes).slice(0, 200)}`,
      );
    return bytes;
  }

  return {
    url,
    log,
    version: async () => (await (await fetch(`${url}/version`)).text()).trim(),
    renderPdf: async (input) => {
      const body = form(input);
      body.append('printBackground', 'true');
      if (input.roll) {
        // Roll paper: the CSS sets no page size; one page as tall as the content (no cut).
        body.append('paperWidth', `${String(input.roll.widthMm)}mm`);
        body.append('singlePage', 'true');
        body.append('preferCssPageSize', 'false');
        for (const side of ['marginTop', 'marginBottom', 'marginLeft', 'marginRight'])
          body.append(side, '0');
      } else {
        body.append('preferCssPageSize', 'true');
      }
      return call('pdf', '/forms/chromium/convert/html', body, input.doc ?? 'probe');
    },
    screenshot: async (input, widthPx) => {
      const body = form(input);
      body.append('width', String(widthPx));
      body.append('height', '1');
      body.append('clip', 'false');
      body.append('format', 'png');
      body.append('optimizeForSpeed', 'false');
      return call('screenshot', '/forms/chromium/screenshot/html', body, input.doc ?? 'probe');
    },
    peakMemory: async (work) => {
      let peakBytes = 0;
      const state = { running: true };
      const poll = (async () => {
        while (state.running) {
          const result = await container
            .exec(['cat', '/sys/fs/cgroup/memory.current'])
            .catch(() => undefined);
          const value = Number(result?.output.trim());
          if (Number.isFinite(value)) peakBytes = Math.max(peakBytes, value);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      })();
      try {
        const result = await work();
        return { result, peakBytes };
      } finally {
        state.running = false;
        await poll;
      }
    },
    stop: async () => {
      await container.stop();
    },
  };
}
