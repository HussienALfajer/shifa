// SILMA TTS v1, self-hosted on the owner's machine (OD-50): the wrapper in spikes/s6-voice/silma
// answers POST /synthesize {text} with audio/wav on 127.0.0.1. Nothing is billed.
import { errorFromResponse, post, type SynthesisResult, type TtsProvider } from '../provider.ts';
import { parseWav } from '../wav.ts';

export interface SilmaConfig {
  endpoint: string;
}

export function createSilmaProvider(config: SilmaConfig): TtsProvider {
  return {
    name: 'silma',
    async synthesize(text: string): Promise<SynthesisResult> {
      const started = performance.now();
      const res = await post('silma', `${config.endpoint}/synthesize`, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw await errorFromResponse('silma', res);
      const audio = new Uint8Array(await res.arrayBuffer());
      return {
        audio,
        mime: 'audio/wav',
        sampleRate: parseWav(audio).sampleRate,
        charactersBilled: 0,
        elapsedMs: performance.now() - started,
      };
    },
  };
}
