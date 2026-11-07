# AR0638 - Review 1

- Job: 2026-11-07-review-ac7c682d
- Branch: arthur/2026-11-07-worker-910b964f
- Commit reviewed: f91eb441e6882360edb106c1dca05b6a8a21dca4
- Verdict: PASS

## Final message

**Findings:** none that block the merge. The branch does what the ticket asks.

- `packages/core/src/host.ts:53`: `host.secrets` is now `[...new Set(hide.values)]`. That covers every env file value (none inside a job) plus each enabled plugin's resolved value, the same set `hide` names. This meets the first Done means point. Values under 8 characters drop out and the order is now longest first. Every consumer already filters them out, so redaction does not change: orchestration's `redactValues` (`credential.ts:18`) and session's `redact` (`credential.ts:8`). `grep` finds no other reader of `host.secrets`.
- `packages/core/test/host.test.ts:61-78`: the test now covers a disabled plugin's value, a value no plugin reads, a file value the shell overrides, and the shell-only set inside a job. `from-the-file` appears twice in the input, so the test also catches a missing de-duplication.
- `packages/orchestration/test/decisions.test.ts:558-571`: this test runs the real CLI `decision ask` and `decision answer`, with an env file in a temp folder holding a disabled plugin's value and a loose one. Both values are short and use one character class, so only `host.secrets` can catch them. The test checks that both reach `spec/decisions.jsonl` as `[redacted]`. It uses the file's existing `demo()` and env pattern and no production resource.
- Docs: `docs/plugin-api.md` (the `secrets` row and the AR0340 line) and `decision.md:22` describe the new set, as the ticket requires. The worker also fixed three other places that still described the old set: `coordinator.md:34,42` and `session.md:102`. Those files are outside the ticket's Scope but not in its Out list, and the final message gives the reason, which the review criteria require for doc lines that would otherwise be stale. `config.md:26` already matched.
- Size: `host.ts` is 168 lines (green). The changed line went from 269 to 234 characters, still 2 counted lines. The `plugin.ts:63` comment is 138 characters, 1 counted line. No budget was raised.

## Notes
- (minor) docs/plugin-api.md:121: the AR0340 line keeps its old wording and adds a "Since AR0638" sentence. It reads as history, which is acceptable, but it is a long line.
- (minor) packages/core/src/testing.ts:115: the fake host still hands its own `env` values as `secrets`. That is fine for a fake and the docs say so, but it is not the real host's set. This code is outside the range.

## Checks (on f91eb441)
- `node --import @arthur/core/testing --test packages/core/test/host.test.ts packages/orchestration/test/decisions.test.ts`: tests 64, pass 64, fail 0.
- Hand mutation: I put the old `secrets` line back in `host.ts` (enabled plugins' values only) and ran the same two files: 62 passed, 2 failed. The failures were the `host.secrets` test and the new decision-log test. I restored the file with `git checkout -- packages/core/src/host.ts`; `git status` was clean afterwards.
- Not run, as you asked: the full `npm run check && npm test` and `npm run mutate`. The worker reports both passing on f91eb441 (tsc passed; 1534 tests passed, 0 failed, 64 skipped; 4 mutants, 0 survived). I have not reproduced those numbers.

PASS