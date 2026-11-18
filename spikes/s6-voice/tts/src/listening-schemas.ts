// File formats of the listening test (criterion 5): the served set, the key kept apart from it,
// the results the page downloads, and the pre-round choice. The results schemas are strict: a field
// that could name the listener fails the parse.
import { z } from 'zod';

const code = z.string().regex(/^[A-Z2-7]{8}$/u);
const servedFile = z.string().regex(/^clips\/[A-Z2-7]{8}\.[a-z0-9]{2,4}$/u);
const setHash = z.string().regex(/^[0-9a-f]{16}$/u);
const category = z.enum(['chime', 'number', 'room', 'doctor', 'name', 'name-plain', 'pre-round']);
const provider = z.enum(['azure', 'google', 'silma', 'fake']);
const gender = z.enum(['male', 'female']);

const setItemSchema = z
  .object({ code, file: servedFile, category, text: z.string().optional() })
  .strict();

const fullSetSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('full'),
    setHash,
    items: z.array(setItemSchema),
    pairs: z.array(z.object({ id: z.string(), a: z.array(code), b: z.array(code) }).strict()),
  })
  .strict();

const preRoundVoiceSchema = z
  .object({
    label: z.number().int().min(1),
    gender,
    clips: z.array(z.object({ code, file: servedFile, phrase: z.number().int() }).strict()),
  })
  .strict();

const preRoundSetSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('pre-round'),
    setHash,
    phrases: z.array(z.string()),
    voices: z.array(preRoundVoiceSchema),
  })
  .strict();

export const listeningSetSchema = z.discriminatedUnion('kind', [fullSetSchema, preRoundSetSchema]);
export type ListeningSet = z.infer<typeof listeningSetSchema>;
export type SetItem = z.infer<typeof setItemSchema>;
export type PreRoundVoice = z.infer<typeof preRoundVoiceSchema>;

export const listeningKeySchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(['full', 'pre-round']),
  setHash,
  seed: z.number().int(),
  voices: z.array(
    z.object({
      voiceId: z.string(),
      provider,
      voice: z.string(),
      label: z.number().int().optional(),
      gender: gender.optional(),
    }),
  ),
  codes: z.record(
    z.string(),
    z.object({
      provider,
      voice: z.string(),
      clipId: z.string(),
      category,
      text: z.string(),
      use: z.enum(['rating', 'pair', 'pre-round']),
    }),
  ),
  pairs: z.array(
    z.object({ id: z.string(), announcementId: z.string(), a: z.string(), b: z.string() }),
  ),
});
export type ListeningKey = z.infer<typeof listeningKeySchema>;

export const listeningResultsSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('full'),
    setHash,
    startedAt: z.string(),
    finishedAt: z.string(),
    ratings: z.array(
      z
        .object({
          code,
          naturalness: z.number().int().min(1).max(5),
          /** null where the clip is not judged correct / wrong (rooms, doctors). */
          wrong: z.boolean().nullable(),
          note: z.string().max(500),
          at: z.string(),
        })
        .strict(),
    ),
    pairs: z.array(
      z.object({ id: z.string(), choice: z.enum(['a', 'b', 'same']), at: z.string() }).strict(),
    ),
  })
  .strict();
export type ListeningResults = z.infer<typeof listeningResultsSchema>;

export const preRoundChoiceSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('pre-round'),
    setHash,
    male: z.number().int().min(1),
    female: z.number().int().min(1),
    chosenAt: z.string(),
  })
  .strict();
export type PreRoundChoice = z.infer<typeof preRoundChoiceSchema>;
