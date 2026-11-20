# Spike 0.3-S5 fixtures

Webhook bodies captured in the manual run (0.3-S5c, 2026-11-18/19) and scrubbed by `messaging/scripts/scrub-fixtures.ts`: every number, LID, group, message key, push name and text is a placeholder (synthetic `9639300…` numbers), and each fixture keeps only the recomputed signature result. `messaging/scripts/check-fixtures.ts` and `messaging/test/fixtures-clean.test.ts` fail on any run of 8+ digits that is not synthetic, any message key that is not a placeholder, Arabic text or a QR payload. Raw captures never leave the git-ignored `.cache/s5/raw/`.

What is kept (owner's decision after the security review, 2026-11-20):
- every `session.status` event, and every event of the owner's two numbers: P (`963930080002@lid`) and G (`963930080001@lid`, `963930090001@c.us`);
- four `*-example-*` files, one per shape that only other people produced (group message, newsletter post, reaction, revoke). Their chat ids, LIDs, keys and times were replaced after the scrub (2026-01-01 09:0x UTC), so they cannot be linked to anyone; their `signature` field is the result for the original body.

Everything else from the run (378 captures of other people's chats, groups, newsletters and read receipts) was deleted before the branch was published.
