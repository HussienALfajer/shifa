// Google Cloud Text-to-Speech v1, Chirp 3 HD voices: `text` input (not SSML), LINEAR16 (a WAV
// with header) at 24 kHz. The API key goes in a header, never in the URL (URLs end up in logs).
import {
  billedCharacters,
  errorFromResponse,
  ProviderError,
  post,
  type SynthesisResult,
  type TtsProvider,
} from '../provider.ts';
import { parseWav } from '../wav.ts';

export interface GoogleConfig {
  key: string;
  /** Base URL override (tests use a local mock server). */
  endpoint?: string;
}

export function createGoogleProvider(config: GoogleConfig): TtsProvider {
  const base = config.endpoint ?? 'https://texttospeech.googleapis.com';
  return {
    name: 'google',
    async synthesize(text: string, voice: string): Promise<SynthesisResult> {
      const started = performance.now();
      const res = await post('google', `${base}/v1/text:synthesize`, {
        headers: { 'X-Goog-Api-Key': config.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'ar-XA', name: voice },
          audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24_000 },
        }),
      });
      if (!res.ok) throw await errorFromResponse('google', res);
      const body = (await res.json()) as { audioContent?: unknown };
      if (typeof body.audioContent !== 'string') {
        throw new ProviderError('google: no audioContent', { status: 502 });
      }
      const audio = new Uint8Array(Buffer.from(body.audioContent, 'base64'));
      return {
        audio,
        mime: 'audio/wav',
        sampleRate: parseWav(audio).sampleRate,
        charactersBilled: billedCharacters(text),
        elapsedMs: performance.now() - started,
      };
    },
  };
}
