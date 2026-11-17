// Criterion 1: the WAHA and PostgreSQL images are pinned by version and digest, and the running
// WAHA is the pinned version with the GOWS engine and the hardening the slice asks for.
import { describe, expect, it } from 'vitest';
import { inspectEnv } from '../src/containers.ts';
import { IMAGES, PINNED_IMAGE, WAHA_VERSION } from '../src/images.ts';
import { useStack } from './use-stack.ts';

describe('image pins', () => {
  it('pins every image as name:version@sha256:<digest>', () => {
    for (const image of Object.values(IMAGES)) expect(image).toMatch(PINNED_IMAGE);
  });

  it('runs the GOWS build of the pinned WAHA release', () => {
    expect(IMAGES.waha).toContain(`devlikeapro/waha:gows-${WAHA_VERSION}@sha256:`);
    expect(WAHA_VERSION).toMatch(/^2026\.\d+\.\d+$/);
  });
});

describe('running WAHA', () => {
  const stack = useStack({ waha: ['clinics'] });

  it('reports the pinned version and GOWS as its engine', async () => {
    const waha = stack.waha.clinics;
    const res = await stack.probe('messaging', `${waha.url}/api/version`, { apiKey: waha.apiKey });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as { version: string; engine: string };
    expect(body.version).toBe(WAHA_VERSION);
    expect(body.engine).toBe('GOWS');
  });

  it('has QR printing, the dashboard and Swagger off, warn level and JSON logs', async () => {
    const env = await inspectEnv(stack.waha.clinics.container);
    expect(env.WHATSAPP_DEFAULT_ENGINE).toBe('GOWS');
    expect(env.WAHA_PRINT_QR).toBe('False');
    expect(env.WAHA_DASHBOARD_ENABLED).toBe('False');
    expect(env.WHATSAPP_SWAGGER_ENABLED).toBe('False');
    expect(env.WAHA_LOG_LEVEL).toBe('warn');
    expect(env.WAHA_LOG_FORMAT).toBe('JSON');
    const waha = stack.waha.clinics;
    for (const path of ['/dashboard', '/-json']) {
      const res = await stack.probe('messaging', `${waha.url}${path}`, { apiKey: waha.apiKey });
      expect(res.status, path).toBe(404);
    }
  });

  it('writes log records as JSON', async () => {
    const lines = (await stack.logs(stack.waha.clinics.container)).split('\n');
    const records = lines.filter((line) => line.trimStart().startsWith('{'));
    for (const line of records) expect(() => JSON.parse(line) as unknown).not.toThrow();
    // No pretty-printed log records ("[12:00:00.000] WARN ...").
    expect(lines.filter((line) => /^\[\d{2}:\d{2}:\d{2}/.test(line))).toEqual([]);
  });
});
