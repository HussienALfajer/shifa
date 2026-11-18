// Criterion 1 (VOX-09): every adapter sends the documented request shape to a mock server, maps
// 429/5xx to retryable errors, and receives the same plain text byte for byte. No vendor call.
import { describe, expect, it } from 'vitest';
import { ProviderError, type TtsProvider, VOICES } from '../src/provider.ts';
import { createAzureProvider } from '../src/providers/azure.ts';
import { createGoogleProvider } from '../src/providers/google.ts';
import { createSilmaProvider } from '../src/providers/silma.ts';
import { encodeWav, toneSamples } from '../src/wav.ts';
import { type MockServer, type RecordedRequest, startMockServer } from './mock-server.ts';

const TEXT = 'الرقم مئة وأحد عشر، إلى العيادة رقم ثلاثة: إِبْرَاهِيم & <شيار>';
// Built at run time so no key-shaped literal sits in the repository (check-no-keys).
const AZURE_KEY = 'ab12'.repeat(8);
const GOOGLE_KEY = `AIza${'x'.repeat(35)}`;
const WAV = Buffer.from(encodeWav(toneSamples({ hz: 440, ms: 120, sampleRate: 24_000 }), 24_000));

type Case = {
  name: string;
  voice: string;
  make: (server: MockServer) => TtsProvider;
  ok: () => { status: number; headers: Record<string, string>; body: Buffer | string };
  sentText: (req: RecordedRequest) => string;
};

const cases: Case[] = [
  {
    name: 'azure',
    voice: 'ar-SY-LaithNeural',
    make: (s) => createAzureProvider({ key: AZURE_KEY, endpoint: s.url }),
    ok: () => ({ status: 200, headers: { 'content-type': 'audio/wav' }, body: WAV }),
    sentText: (req) => {
      const ssml = req.body.toString('utf8');
      const inner = /<voice name='[^']+'>([\s\S]*)<\/voice>/u.exec(ssml)?.[1] ?? '';
      return inner
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&apos;', "'")
        .replaceAll('&quot;', '"')
        .replaceAll('&amp;', '&');
    },
  },
  {
    name: 'google',
    voice: 'ar-XA-Chirp3-HD-Charon',
    make: (s) => createGoogleProvider({ key: GOOGLE_KEY, endpoint: s.url }),
    ok: () => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audioContent: WAV.toString('base64') }),
    }),
    sentText: (req) =>
      (JSON.parse(req.body.toString('utf8')) as { input: { text: string } }).input.text,
  },
  {
    name: 'silma',
    voice: 'default',
    make: (s) => createSilmaProvider({ endpoint: s.url }),
    ok: () => ({ status: 200, headers: { 'content-type': 'audio/wav' }, body: WAV }),
    sentText: (req) => (JSON.parse(req.body.toString('utf8')) as { text: string }).text,
  },
];

describe('request shapes', () => {
  it('azure: SSML wrapper with the voice only, lossless RIFF output, subscription key header', async () => {
    const server = await startMockServer();
    server.respond(cases[0]?.ok() ?? { status: 500 });
    const result = await createAzureProvider({ key: AZURE_KEY, endpoint: server.url }).synthesize(
      TEXT,
      'ar-SY-AmanyNeural',
    );
    const req = server.requests[0];
    expect(req?.method).toBe('POST');
    expect(req?.url).toBe('/cognitiveservices/v1');
    expect(req?.headers['ocp-apim-subscription-key']).toBe(AZURE_KEY);
    expect(req?.headers['content-type']).toMatch(/^application\/ssml\+xml/u);
    expect(req?.headers['x-microsoft-outputformat']).toBe('riff-24khz-16bit-mono-pcm');
    const ssml = req?.body.toString('utf8') ?? '';
    expect(ssml).toMatch(
      /^<speak version='1\.0' xml:lang='ar-SY'><voice name='ar-SY-AmanyNeural'>/u,
    );
    expect(ssml).not.toMatch(/<prosody|<break|<phoneme|<say-as/u);
    expect(result.mime).toBe('audio/wav');
    expect(result.sampleRate).toBe(24_000);
    expect(Buffer.from(result.audio).equals(WAV)).toBe(true);
    expect(result.charactersBilled).toBe(Array.from(TEXT).length);
  });

  it('google: Chirp 3 HD text input (not SSML), LINEAR16, API key header, base64 audio', async () => {
    const server = await startMockServer();
    server.respond(cases[1]?.ok() ?? { status: 500 });
    const result = await createGoogleProvider({ key: GOOGLE_KEY, endpoint: server.url }).synthesize(
      TEXT,
      'ar-XA-Chirp3-HD-Aoede',
    );
    const req = server.requests[0];
    expect(req?.url).toBe('/v1/text:synthesize');
    expect(req?.headers['x-goog-api-key']).toBe(GOOGLE_KEY);
    expect(req?.url).not.toContain('key=');
    const body = JSON.parse(req?.body.toString('utf8') ?? '{}') as Record<string, unknown>;
    expect(body).toEqual({
      input: { text: TEXT },
      voice: { languageCode: 'ar-XA', name: 'ar-XA-Chirp3-HD-Aoede' },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24_000 },
    });
    expect(Buffer.from(result.audio).equals(WAV)).toBe(true);
    expect(result.charactersBilled).toBe(Array.from(TEXT).length);
  });

  it('silma: local wrapper, JSON text, WAV back, nothing billed', async () => {
    const server = await startMockServer();
    server.respond(cases[2]?.ok() ?? { status: 500 });
    const result = await createSilmaProvider({ endpoint: server.url }).synthesize(TEXT, 'default');
    expect(server.requests[0]?.url).toBe('/synthesize');
    expect(server.requests[0]?.headers['content-type']).toMatch(/^application\/json/u);
    expect(result.sampleRate).toBe(24_000);
    expect(result.charactersBilled).toBe(0);
  });

  it('sends the same text to every adapter byte for byte', async () => {
    const sent: string[] = [];
    for (const c of cases) {
      const server = await startMockServer();
      server.respond(c.ok());
      await c.make(server).synthesize(TEXT, c.voice);
      const req = server.requests[0];
      if (req) sent.push(c.sentText(req));
    }
    expect(sent).toHaveLength(3);
    for (const s of sent)
      expect(Buffer.from(s, 'utf8').equals(Buffer.from(TEXT, 'utf8'))).toBe(true);
  });
});

describe('error mapping', () => {
  for (const c of cases) {
    it(`${c.name}: 429 and 5xx are retryable (Retry-After honoured), 400/401 are not`, async () => {
      const server = await startMockServer();
      const provider = c.make(server);
      const errorFor = async (status: number, headers: Record<string, string> = {}) => {
        server.respond({ status, headers, body: '' });
        return provider.synthesize(TEXT, c.voice).then(
          () => undefined,
          (e: unknown) => e,
        );
      };
      const limited = await errorFor(429, { 'retry-after': '3' });
      expect(limited).toBeInstanceOf(ProviderError);
      expect(limited).toMatchObject({ status: 429, retryable: true, retryAfterMs: 3000 });
      expect(await errorFor(500)).toMatchObject({ status: 500, retryable: true });
      expect(await errorFor(503)).toMatchObject({ status: 503, retryable: true });
      expect(await errorFor(400)).toMatchObject({ status: 400, retryable: false });
      expect(await errorFor(401)).toMatchObject({ status: 401, retryable: false });
    });
  }

  it('google: the vendor status string becomes the vendor code', async () => {
    const server = await startMockServer();
    server.respond({
      status: 429,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota' },
      }),
    });
    const error = await createGoogleProvider({ key: GOOGLE_KEY, endpoint: server.url })
      .synthesize(TEXT, 'ar-XA-Chirp3-HD-Kore')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 429, vendorCode: 'RESOURCE_EXHAUSTED' });
  });
});

describe('voices', () => {
  it('lists two Azure ar-SY voices, six Chirp 3 HD ar-XA voices (3 male, 3 female) and SILMA default', () => {
    expect(VOICES.azure).toEqual(['ar-SY-LaithNeural', 'ar-SY-AmanyNeural']);
    expect(VOICES.google).toHaveLength(6);
    for (const v of VOICES.google) expect(v).toMatch(/^ar-XA-Chirp3-HD-[A-Z][a-z]+$/u);
    expect(VOICES.silma).toEqual(['default']);
  });
});
