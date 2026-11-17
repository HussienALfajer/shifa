# Spike 0.3-S5 fixtures

Webhook bodies captured in the manual run (0.3-S5c) and scrubbed by `messaging/scripts/scrub-fixtures.ts`: every number, LID, group, message key, push name and text is a placeholder (synthetic `+96393009XXXX`-style numbers), and each fixture keeps only the recomputed signature result. `messaging/scripts/check-fixtures.ts` (and `messaging/test/scrubber.test.ts`) fail on any run of 8+ digits that is not synthetic. Raw captures never leave the git-ignored `.cache/s5/raw/`.
