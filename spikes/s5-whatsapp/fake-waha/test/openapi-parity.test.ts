// Criterion 2: the fake serves only methods and paths present in the OpenAPI document fetched
// from the pinned image, and that document records the digest it came from.
import { readFileSync } from 'node:fs';
import { IMAGES } from '@shifa-spike/s5-stack';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OPENAPI_DOCUMENT, OPENAPI_SOURCE } from '../src/openapi.ts';
import { type FakeWaha, startFakeWaha } from '../src/index.ts';

interface OpenApi {
  info: { version: string };
  paths: Record<string, Record<string, unknown>>;
}
const doc = JSON.parse(readFileSync(OPENAPI_DOCUMENT, 'utf8')) as OpenApi;
const source = JSON.parse(readFileSync(OPENAPI_SOURCE, 'utf8')) as { image: string };

describe('fake WAHA and the pinned OpenAPI document', () => {
  let fake: FakeWaha;
  beforeAll(async () => {
    fake = await startFakeWaha({
      container: 'clinics',
      apiKey: 'parity-key',
      hmacKey: 'parity-hmac',
      webhookUrl: 'http://127.0.0.1:9/unused',
    });
  });
  afterAll(async () => {
    await fake.close();
  });

  it('serves only WAHA methods and paths that the document has (fault API aside)', () => {
    const served = fake.servedRoutes().filter((route) => !route.path.startsWith('/__fake/'));
    expect(served.length).toBeGreaterThanOrEqual(10);
    for (const { method, path } of served) {
      expect(doc.paths[path]?.[method.toLowerCase()], `${method} ${path}`).toBeDefined();
    }
  });

  it('serves every endpoint the spike uses', () => {
    const served = new Set(fake.servedRoutes().map((r) => `${r.method} ${r.path}`));
    for (const route of [
      'POST /api/sessions',
      'GET /api/sessions/{session}',
      'POST /api/sessions/{session}/start',
      'POST /api/sessions/{session}/stop',
      'GET /api/{session}/auth/qr',
      'POST /api/sendText',
      'POST /api/sendSeen',
      'POST /api/startTyping',
      'POST /api/stopTyping',
      'GET /api/{session}/lids/{lid}',
    ]) {
      expect(served.has(route), route).toBe(true);
    }
  });

  it("records the pinned image's digest as the document's source", () => {
    expect(source.image).toBe(IMAGES.waha);
    expect(IMAGES.waha).toContain(`:gows-${doc.info.version}@`);
  });

  it('refuses calls without the API key', async () => {
    const res = await fetch(`${fake.url}/api/sessions/default`);
    expect(res.status).toBe(401);
  });
});
