# AR0618 - Review 1

- Job: 2026-11-05-review-f940b141
- Branch: arthur/2026-11-04-worker-aa9e83cc
- Commit reviewed: 9d1af42b23db6b2ab5388a0b1d76d7db6b704546
- Verdict: PASS

## Final message

No finding blocks the merge. The matcher change in `packages/delivery/src/checks-extension.ts:97` covers what AR0618 asks for:
- **Assignments:** a run now counts after leading `NAME=value` assignments, with plain, `"…"` or `'…'` values.
- **bun:** `bun run check`, `bun run test` and `bun run mutate` count, and `bun test` does not.
- **Text-only mentions:** a command that only names the script in text still records nothing.
- **Tests and doc:** the new test in `packages/delivery/test/checks.test.ts:79` covers each form and the 1800 s timeout. It fails when the new forms are removed (my mutations below). The `review-needed.md` checks paragraph names the new forms.

The diff touches only the three files the ticket's Scope names. `checks-extension.ts` is 98 lines, and the structure test passes, so `delivery` stays inside its line budget. What the worker's final message claims matches what I ran.

## Notes
- (minor) `packages/delivery/src/checks-extension.ts:97`: one mutation survives. Changing the `\s+` after an assignment to `\s*` passes all 15 tests, so nothing guards against `A=1npm test` being counted as a run. The harm is small: a command like that fails, so it would only record `fail`, never a pass.
- (risk) `packages/delivery/src/checks-extension.ts:97`: an assignment whose value is a command substitution still records nothing. With `TMPDIR=$(pwd)/tmp npm run check` the matcher found 0 runs, so the branch would still be refused with `no check`. The ticket's own example uses `$PWD`, which does match.
- (minor) `packages/delivery/src/checks-extension.ts:97`: a separator inside quotes still counts, and this was already so before the branch. `A="x; npm run check "` gives 1 run; the test's version without the trailing space gives none.

## Checks (on `9d1af42b`)
- `npm run check`: tsc passed with no errors. `npm test`: 1550 tests, 1486 pass, 0 fail, 64 skipped (bash timeout 1800 s).
- Hand mutations, each followed by a run of `node --import @arthur/core/testing --test packages/delivery/test/checks.test.ts` and restored with `git checkout -- <file>`; the checkout was clean afterwards:
  - `(?:npm|bun)\s+run` changed to `npm\s+run`: caught, 14 pass / 1 fail.
  - The assignment group removed: caught, 14 pass / 1 fail.
  - `bun test` accepted alongside `npm test`: caught, 14 pass / 1 fail.
  - `\s+` after an assignment changed to `\s*`: survived, 15 pass / 0 fail.
- Matcher probes with `node -e`:
  - `A=1npm test` → 0 runs.
  - `env A=1 npm test` → 0 runs.
  - `A=$(pwd) npm test` → 0 runs.
  - `x=1 x=2 bun run test` → 1 run.
  - 20,000 repeated assignments, and `;a=` repeated 20,000 times: 1 ms in total, so the regex does not backtrack badly on long input.
- I did not run `npm run mutate`, to stay within the small budget; the hand mutations above were run instead.

PASS