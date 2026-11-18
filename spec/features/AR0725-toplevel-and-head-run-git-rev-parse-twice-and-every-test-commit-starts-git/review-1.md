# AR0725 - Review 1

- Job: 2026-11-18-review-f279ae30
- Branch: arthur/2026-11-18-worker-4dce6d1a
- Commit reviewed: 74aba6103b1dd1085682657432f51d744a2662fa
- Verdict: PASS

## Final message

No findings. `topLevel` and `head` in `packages/core/src/git.ts` now each make one `spawnSync` and read its status and output. `packages/core/src/test-env.ts` writes `[maintenance]\n\tauto = false` into the kit's git config. All Done-means points are met within Scope.

- Both functions keep their answers. Like the old `yes`, a spawn error leaves `status` null, so the answer is `undefined`. The old code then never reached `git()`, so its throw is not a lost behavior.
- Dropping `--quiet` from `head` is safe. `spawnSync` with `encoding` pipes stderr, so Git's message never reaches the user, and a failed `--verify` prints nothing on stdout. The final message gives the reason.
- The header comment's new wording holds. Every call in `git.ts` goes through `GIT` (`--no-replace-objects`, `core.hooksPath=/dev/null`, `core.fsmonitor=false`).
- New tests cover:
  - outside Git, a missing folder, and a repository with no commit;
  - an annotated tag, a short id and `HEAD~1`;
  - a tree, a blob, `HEAD~2`, an empty name, `--all`, `main v1` and `v1..main`;
  - a replacement under `refs/replace`, which is not read;
  - exactly one git start per call, with the hardened options, checked through a PATH wrapper that hands the real git the original PATH, so Git's own child processes are not counted.
- The maintenance test checks both sides: no `git maintenance run --auto` in `GIT_TRACE` under the kit, and one with `-c maintenance.auto=true`.
- I found no stale mention of the old two-call behavior. `git-config.ts` and the guards already treat `maintenance.auto` as a key a job can write.
- The before and after numbers are in the final message's table and its "What went in". The git count falls by 5,529, above the 5,000 asked for. I did not rerun the trace.
- No source file moves into yellow. The worker says the core is at its budget exactly (7607 of 7607); the structure test passes.

## Notes
- (minor) packages/core/test/git.test.ts:52: `loggedGit` puts `PATH` and the log path inside single quotes in a shell script. A PATH or temporary folder containing `'` breaks the wrapper. This is test-only and the kit's `TMPDIR` has no quote.

## Checks (all on `74aba610`)
- `npm run mutate`: `mutate: 26 mutants, 26 caught, 0 survived`, no `not run (time)` (538 s).
- `npm run check && npm test`, one call: `tsc` clean. In the `npm test` output I filtered, there is no `not ok` line, and the structure test passes with six yellow files, none of them changed by this branch. My filter missed the summary lines, so I have no counts from this run.
- `npm test` again on its own: exit 0 (424 s). Output was discarded, so again no counts.
- `node --import @arthur/core/testing --test packages/core/test/git.test.ts packages/core/test/testing.test.ts`: tests 26, pass 24, fail 0.
- `git status --short` afterwards: empty.

PASS