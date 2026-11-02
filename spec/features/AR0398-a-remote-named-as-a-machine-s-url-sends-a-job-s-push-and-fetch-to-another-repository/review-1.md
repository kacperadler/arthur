# AR0398 - Review 1

- Job: 2026-11-02-review-44c1cf28
- Branch: arthur/2026-11-02-worker-6ffaf5c2
- Commit reviewed: 1ba5e03642ee4d946e332e0fdf20b785d39d887c
- Verdict: PASS

## Final message

I found no blocking findings. The branch takes the ticket's second option: `gitOver` no longer hands the machine's URL to any Git command that looks up a remote. I checked it against every point in the ticket's "Done means":

- **Push** (`packages/core/src/job-machine.ts:161`): the base now goes by `git send-pack <ssh>:<home>/repos/<project>.git`. `send-pack` looks up a remote only when given `--remote`, so a `remote."gpu:…".url` or `pushurl` in the checkout's config is never read.
- **Fetch** (`packages/core/src/machine-sync.ts:88`): the sweep now runs `git fetch-pack` from the machine's URL, then `git branch --force arthur/<id> <tip>`. `git branch` still refuses a branch that a worktree here has checked out, as `git fetch` did, and the test checks that refusal.
- **Tests**: `packages/core/test/machine.test.ts` checks the base arrives with `url` set to a helper (`evil::x`, `evil://x`), a folder, or another repository over ssh, and with `pushurl` set to another repository. It checks the fetched branch is the machine's tip, not the other repository's, and that nothing is pushed to that other repository. A separate test writes a `pushurl` right after the config check, which closes the timing gap of the `configRefusal` option.
- **Docs**: `spawn.md`, `deploy.md` and `spec/roadmap.md` are updated. A search for `GIT_PROTOCOL_FROM_USER`, `AR0393`, `transport '` and the old push and fetch commands found no stale lines. The remaining `GIT_PROTOCOL_FROM_USER` mention in `deploy.md` now covers `github.push` only, which is still true.
- **Size**: `structure.test.ts` passes, so the core's line budget holds; no file moved into yellow or red.

## Notes
- (minor) packages/core/src/machine-sync.ts:88: `?? ""` can never apply. `.split(" ")[0]` always returns a string. If `fetch-pack` printed nothing, the result would be `""`, and `git branch` would fail with its own error.
- (minor) packages/core/src/job-machine.ts:147: two flags no longer change anything, but `docs/deploy.md` still lists them. The worker's mutation run had these two survivors: removing `--no-replace-objects`, and changing `core.fsmonitor=false` to `true`. The worker shows the first has no effect on these commands and only infers the second; keeping both matches the doc.

## Checks
- `npm run check` (tsc): clean.
- `npm test`: 1494 tests, 1430 passed, 0 failed, 64 skipped. This matches the worker's numbers.
- Hand mutation, `send-pack` changed back to `push` in `reach`: both new tests failed (`node --test --test-name-pattern="remote named as" packages/core/test/machine.test.ts`, 0 passed, 2 failed). I restored the file with `git checkout`, and `git status` was clean afterwards.
- I did not run `npm run mutate` because of the budget you set.

PASS