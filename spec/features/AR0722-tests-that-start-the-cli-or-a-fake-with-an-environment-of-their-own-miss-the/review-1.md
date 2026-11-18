# AR0722 - Review 1

- Job: 2026-11-18-review-318b6bac
- Branch: arthur/2026-11-18-worker-e6dc9838
- Commit reviewed: d5da80b371a9575d5a5fd63dec7d54234eca14ec
- Verdict: PASS

## Final message

Nothing blocks the merge. All 39 hand-built `env` objects that start a Node child now carry `NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE`, across 26 test files. The diff changes only test files and the ticket's new `findings.md`.

- **Every site is covered.** I searched `packages/*/test` and `test` for object literals with a `PATH:` key that have neither `NODE_COMPILE_CACHE` nor `...process.env`. What is left is not a bare env for a Node child:
  - `sandbox.test.ts:274` and `install.test.ts:83` are `jobs.prepare` values that the job's env is built on top of.
  - `processes.test.ts:112` goes into `play()`, which spreads `...process.env` (`processes.test.ts:46`).
  - `plugin-new.test.ts:298` spreads `ENV`, which is `process.env` minus `NODE_TEST_CONTEXT`.
  - The rest are `withEnv`, `assert.deepEqual` values, or comments.
- **Inline spawns are covered too.** A second search for an inline `env: {` passed to `spawn`/`exec*` without the variable or a spread found no match.
- **The wrapper and the fake agent need no edit.** `launch` passes on every non-`ARTHUR_` variable (`packages/core/src/job-scope.ts:68`), so the worker's reason holds.
- **The scope widened on purpose.** The worker edited 12 files outside the Scope's 14. The ticket's "every `env`" rule asks for that, and the final message explains it.
- **The type change is sound.** `doctor.test.ts:358`: `start()` now takes a `NodeJS.ProcessEnv` because the value may be `undefined`. `tsc` passes.
- **The speedup reproduces, for the `cli.test.ts` measure.** I reran Done means' `/usr/bin/time` check on `packages/core/test/cli.test.ts` (results under Checks). I did not redo the traced count of slow CLI starts.
- **No test fails if a site drops the variable again.** The worker already recorded this as F1, so it is not a new finding.

## Notes
- (risk) packages/core/test/cli.test.ts:36: With `NODE_DISABLE_COMPILE_CACHE` set, the 39 bare-env children still use the cache. They get `NODE_COMPILE_CACHE` but not the off switch, which `testing.test.ts:322` treats as turning the cache off. Before this branch these children never cached. The ticket prescribes exactly this form, so this is not a deviation, but the off switch now misses these children.
- (minor) test/report-check.test.ts:220: This child is `/bin/bash -c` running a `node -e` command. Adding the variable here follows the literal rule, but the worker measured no gain, as he says.

## Checks (on `d5da80b3`, detached checkout)
- `npm run mutate`: `mutate: 0 mutants, 0 caught, 0 survived`. The diff has no source code to mutate.
- `npm run check && npm test`, in one call: `tsc` printed nothing. 1910 tests, 1846 pass, 0 fail, 64 skipped, `duration_ms 371377`.
- `/usr/bin/time` on `node --import @arthur/core/testing --test packages/core/test/cli.test.ts`:

  | Tree | Tests passing | Wall | User + sys CPU |
  |---|---|---|---|
  | Tip | 25 of 25 | 18.58 s | 21.5 s |
  | Base `6c9abe65` file, swapped in | 25 of 25 | 35.18 s | 64.4 s |

  After the base run I restored the file with `git checkout --`, and `git status --short` was empty.

PASS