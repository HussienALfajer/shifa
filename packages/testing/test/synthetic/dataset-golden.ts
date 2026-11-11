// Golden SHA-256 of `canonicalJson(generateDataset({ seed: 1, preset: 'minimal' }))`.
// Kept apart from the locked determinism test because its value exists only once the generator
// does. Update only on purpose (new record type, new field, changed draw order) with a PR note.
export const GOLDEN_MINIMAL_SEED_1_SHA256 =
  '3e19433f007377b0ab82d365e29f815db96127507384a40aaa53f93ef208f7cc';
