# AR0528 - Review 1

- Job: 2026-11-06-review-f64b7b13
- Branch: arthur/2026-11-06-worker-8dfeac5d
- Commit reviewed: b5476e1e77737dd4c3537f0d5db13714467aa488
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0528 and the approved AR0527 plan ask, and every hand mutation of a key behaviour I tried was caught by a test.

**The three mutate survivors don't change behaviour.** Each is `mutate.ts`'s "hunk reverted to the base" on `packages/core/src/cli.ts`:
- **`cli.ts:14`** (`@@ -28 +13,0`): the revert puts back `const USAGE = …` at module top. Nothing in `cli.ts` reads it any more; `usage`, `unknown` and `help` now use the copy in `core-commands.ts`.
- **`cli.ts:58`** (`@@ -68 +58`): the revert puts back `load()`'s old return type, without `append?`. It's a type-only change that is erased at runtime; `tsc` would reject it, but the tests run without `tsc`.
- **`cli.ts:73`** (`@@ -199,2 +72,0`): the revert inserts `process.stdout.write(readFileSync(…)); return 0;` after the try/catch inside `load()`. Both branches of that try/catch already return, so the inserted lines never run.

**Against the plan and ticket:**
- **Actor order** (`packages/core/src/actor.ts:12-24`): the job comes first, then the owner on a channel (`message-received`/`phone-command`, as the plan's table says), then the first `actor` a plugin provides, then `arthur`/`plugin:<name>` when the process `holds(run.pid)`, then `user:terminal:<user>`. `on` comes from the provided answer or from the event's `answers`.
- **The wrapper** stamps its own events `job:<id>`, as the plan's risk section asks (`wrapper.ts:66`; checked in `spawn.test.ts`).
- **Orchestration** answers `coordinator` only when `ARTHUR_ORCHESTRATION_FOLDER` is its own folder. `on` is the numbers from `inbox/turn/<seq>-<ms>`, sorted.
- **The four new events**, each emitted where the plan names:
  - `command-ran` in `cli.ts`, after the command returns. It is not logged inside a job, in an eval, without a load, for an unknown command, or for `--help`.
  - `phone-command` in `plugin-host.ts`'s `route` wrapper. It is not logged inside a job.
  - `run-started` in `run.ts`, only once every plugin started and no signal came during the starts.
  - `schedule-fired` in `sweep.ts`, after the claim. Each has a test, including the refusals.
- **The omp terminal-input hook** was checked and reported as F1 in `findings.md`. The `by` stamp, the four events, `holds`, and the budgets 7307 / 2761 / 621 match AR-D533. `docs/plugin-api.md`, `run.md` and `schedule.md` are updated. No stale budget numbers remain in the docs, the roadmap or the roles.
- **Leaks:** nothing in the diff names a real client or project; the names used are made up (`acme`, `blog`, `shop`).

## Notes
- (minor) packages/core/src/wrapper.ts:66: the file stays yellow and gets one line longer. It counts 217 → 218 under the width rule, and it was already yellow at the base. The final message doesn't mention it.
- (risk) packages/core/src/actor.ts:20: the coordinator stamp rests on an environment variable the coordinator can clear, so it attributes but proves nothing. The plan says so and leaves it to AR0502's gate.

## Checks (on b5476e1e)
- `npm run check`: clean (tsc).
- I did not rerun the full suite, as you asked. I ran these files with `node --import @arthur/core/testing --test`: core `actor`, `cli`, `run` and `spawn`; orchestration `actor` and `silent`; schedule `schedule` and `registered`; and `test/structure.test.ts`. Result: 117 tests, 116 pass, 0 fail, 1 skipped. The structure test passed.
- Hand mutations, each restored with `git checkout --` (`git status` was clean afterwards):
  - `actor.ts` job check disabled: 2 failed in `actor.test.ts`.
  - `plugin-host.ts` `own.job` guard removed: the in-job phone-command test failed.
  - `cli.ts` `job === undefined` guard removed: the in-job cli test failed.
  - `actor.ts` `holds(run.pid)` inverted: 2 tests failed.
  - orchestration's environment check removed: its actor test failed.
- I did not run `npm run mutate`; the survivors above are judged from `test/mutate.ts` and the `--unified=0` hunks of `cli.ts`.

PASS