// Golden SHA-256 of `canonicalJson(generateDataset({ seed: 1, preset: 'minimal' }))`.
// Kept apart from the locked determinism test because its value exists only once the generator
// does. Update only on purpose (new record type, new field, changed draw order) with a PR note.
export const GOLDEN_MINIMAL_SEED_1_SHA256 =
  '3b33ded29c7aaebd118a3c24ebbd7e855b3dcaaea68dab7e55d48bcf049451ff';
