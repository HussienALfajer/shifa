export { makeChime } from './chime.ts';
export { type GenerateOptions, type GenerateResult, generate } from './generate.ts';
export {
  checkCompleteness,
  type Manifest,
  type ManifestClip,
  manifestSchema,
  readManifest,
  sha256Hex,
} from './manifest.ts';
export type { ProviderName, SynthesisResult, TtsProvider } from './provider.ts';
export { createFakeProvider, fakeDurationMs } from './providers/fake.ts';
export { buildTestSet, numberClipId, roomClipId } from './testset.ts';
export { encodeWav, parseWav } from './wav.ts';
