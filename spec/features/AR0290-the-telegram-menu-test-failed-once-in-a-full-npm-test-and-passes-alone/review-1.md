# AR0290 - Review 1

- Job: 2026-10-22-review-ar0290-8cf7191d
- Branch: h/2026-10-22-ar0290-1ab1dbc4
- Commit reviewed: c15cbf0407af2fe3871c5f94b8d8afe5343dd057
- Verdict: PASS

## Final message

All verification complete, worktree clean.

**Findings:** none.

**Notes:**
- Scope strictly test-only, as the ticket's `Decisions` (F2 of AR0277) implies the plugin itself is correct; worker's final message explicitly justifies not touching `menu.ts`.
- `holds()` duplicates the id-stripping of `token.split(":")[0]` already present in `record()`/`menu.ts`; minor, not worth a helper at this size.

**Checks run (in this worktree, against `d07488c2..c15cbf04`):**
- `npm ci`: clean install, 22 packages.
- `npm run check` (`tsc`): exit 0, no diagnostics.
- `npm test`: 1027/1027 passed, 0 failed, 291.9 s — matches the worker's claimed count exactly.
- `commands.test.ts` alone × 10: 7/7 passed every time.
- Reproduced the original race directly: patched `fake-bot-api.ts` to answer `setMyCommands`/`deleteMyCommands` 100 ms late (mirroring the worker's stated repro), restored the **old** (pre-fix) `commands.test.ts` → failed every run (3/3) with `AssertionError: keyed by the bot's id, never its token`, actual `['7012345678']` — exactly the worker's reported failure. Swapped in the **new** (fixed) test under the same delay → 5/5 passed. Restored `fake-bot-api.ts`.
- Mutation testing on `menu.ts` against the fixed test, each applied then reverted (`git diff --stat` empty afterward):
  - Removed the `continue` short-circuit → test failed: `the same commands: nothing set again` (`4 !== 2`). Matches claim.
  - Removed `renameSync` (record never written) → failed: `timed out waiting for the menu record and a poll`. Matches claim.
  - Removed `console.error` → failed with the same timeout (the error-wait start never gets `logged.length > 0`). Matches claim.
  - Forced `setMyCommands` always, never `deleteMyCommands` → failed with the same timeout (the scripted `deleteMyCommands` failure is never hit, no error ever logged). Matches claim.
- Did not re-run the two "test, with the delay" mutations table rows (first/failing-start checks) or the two intentionally-still-passing rows separately; the per-bot `holds()` logic inspected directly (`menu.ts` processes bots sequentially, writes succeed independently) is consistent with the worker's stated reasoning for why those two specific omissions are harmless.
- Diff stat (`17 insertions(+), 8 deletions(-)`, one file) matches the final message exactly.

No boundary, secret, line-budget, or dependency violations; diff is confined to the one test file the ticket's Scope names.

PASS
