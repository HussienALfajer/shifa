// Azure AI Speech, REST text-to-speech. Plain text only: the minimal <speak> wrapper names the
// voice and nothing else (no prosody, break or phoneme tags). Lossless 24 kHz 16-bit mono RIFF.
import {
  billedCharacters,
  errorFromResponse,
  post,
  type SynthesisResult,
  type TtsProvider,
} from '../provider.ts';
import { parseWav } from '../wav.ts';

export const AZURE_OUTPUT_FORMAT = 'riff-24khz-16bit-mono-pcm';

export interface AzureConfig {
  key: string;
  /** e.g. westeurope; ignored when `endpoint` is given. */
  region?: string;
  /** Base URL override (tests use a local mock server). */
  endpoint?: string;
}

const escapeXml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&apos;')
    .replaceAll('"', '&quot;');

export function azureSsml(text: string, voice: string): string {
  return `<speak version='1.0' xml:lang='ar-SY'><voice name='${escapeXml(voice)}'>${escapeXml(text)}</voice></speak>`;
}

export function createAzureProvider(config: AzureConfig): TtsProvider {
  // A region is a bare word (westeurope); anything else, such as a pasted key or a host, would
  // put a secret into DNS or send the key header elsewhere.
  if (config.endpoint === undefined && !/^[a-z0-9]{2,40}$/u.test(config.region ?? '')) {
    throw new Error('S6_AZURE_REGION must be a bare Azure region name such as westeurope');
  }
  const base = config.endpoint ?? `https://${config.region ?? ''}.tts.speech.microsoft.com`;
  return {
    name: 'azure',
    async synthesize(text: string, voice: string): Promise<SynthesisResult> {
      const started = performance.now();
      const res = await post('azure', `${base}/cognitiveservices/v1`, {
        headers: {
          'Ocp-Apim-Subscription-Key': config.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
          'User-Agent': 'shifa-s6-spike',
        },
        body: azureSsml(text, voice),
      });
      if (!res.ok) throw await errorFromResponse('azure', res);
      const audio = new Uint8Array(await res.arrayBuffer());
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
