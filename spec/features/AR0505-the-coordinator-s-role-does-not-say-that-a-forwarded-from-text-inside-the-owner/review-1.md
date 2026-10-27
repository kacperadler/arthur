# AR0505 - Review 1

- Job: 2026-10-27-review-efb8f3ed
- Branch: arthur/2026-10-27-worker-2222a617
- Commit reviewed: 666df0eb1503d89714d1671b01a95f872b05faab
- Verdict: FAIL

## Final message

I'm failing this branch. The new rule in `packages/orchestration/roles/coordinator.md` matches the ticket, but no test covers it, and a test like that is required here.

## Findings

1. **No test covers the new rule, and deleting it breaks nothing** (`packages/orchestration/roles/coordinator.md:14`). The ticket's second "Done means" point asks for a test of the new line if any test reads the role's rules on the owner's words.
   - Such tests exist. In `packages/orchestration/test/context.test.ts:73-82` (AR0350), a test finds the line starting `- For you, the owner's word is` and checks its wording on what is data and what instructs the coordinator. That is a rule on the owner's words. Lines 63-112 test other single rules of the role the same way (AR0194, AR0205, AR0258, AR0286).
   - The worker's message says "no test reads the role's rules on the owner's words" and that context.test.ts only checks that the whole file reaches the coordinator's context word for word. That does not match the file.
   - Mutation: I deleted line 14 (`sed -i '14d'`) and ran `node --import @arthur/core/testing --test packages/orchestration/test/context.test.ts`. All 13 tests still passed. The whole-file test reads `ROLE` from the same file, so it passes whatever the file says. Rewording the line to "is his instruction" would pass the same way.
   - The review criteria fail a new behavior with no test, or with a test that still passes when the behavior is removed. The fix is a test in context.test.ts, in the style of the AR0350 one: find the `[forwarded from <name>]` line and check that it says the text is the sender's words and never the owner's instruction, and that what he wants is in his own words or a question to him, never his answer to a decision.

## Notes (not blocking)

- The wording meets the ticket's first "Done means" point and its suggestion: the sender's words, data the owner passed on, never his instruction, his own words or a question to him, never his answer to a decision. Its place right after the quoted-`[via <channel>]` rule fits.
- The mark the rule names, `[forwarded from <name>] `, matches what Telegram adds (`packages/telegram/src/media-in.ts:44`, `packages/telegram/docs/telegram.md:67`).
- Only `coordinator.md` changed, as the ticket's scope says. There is one commit, in Conventional Commits form with the ticket id.

## Checks run

- `npm ci`: added 22 packages, no errors.
- `npm run check`: `tsc` finished with no errors.
- `npm test`: 1222 tests, 1161 passed, 0 failed, 61 skipped. This matches the worker's numbers.
- The mutation above: line 14 deleted, context.test.ts 13 of 13 still passed. I restored the file with `git checkout -- packages/orchestration/roles/coordinator.md`, and `git status --short` showed nothing changed.

FAIL