# AR0599 - Review 1

- Job: 2026-11-01-review-a33e426f
- Branch: arthur/2026-10-31-worker-111db639
- Commit reviewed: 0535553cf09cff5c28fe1a146e66449844623507
- Verdict: FAIL

## Final message

I'm failing this branch. The fix itself works, but `arthur continue --help` still tells the owner a continued run reuses the scope's old name, which is now false.

## Findings

1. **`packages/core/docs/commands/continue.md:16`: the `continue` command's help page is now wrong.** It still says the continue waits up to 5 seconds for an old wrapper "since the new one starts in a scope of the same name and two never run for one job". After this branch, a continued run starts in `arthur-job-<id>.<ms>.scope` (`packages/core/src/job-scope.ts:60`). `spawn.md:68` now says that too, so the two help pages disagree. The worker removed the same claim from the code comment in `packages/core/src/job-control.ts:115` but left it in this doc. The review criteria say a changed command updates the doc page its `--help` prints, and a misleading doc is not just wording. Fix: give the one-wrapper-per-job rule as the only reason for the wait.

## Notes
- (risk) ticket "Done means": "`job-control.test.ts` passes 30 times in a row on this machine" is neither claimed in the worker's final message nor run by me. The new name removes the race by design, but this point has no evidence.
- (risk) `packages/core/src/job-scope.ts:155`: nothing here tests `ownScope` matching the continued scope; only the real-systemd test in `scope.test.ts:104` does, and it is skipped in this sandbox. Reverting the line to the old `endsWith` would pass everything here; CI on the pushed tip covers it.
- (minor) `packages/delivery/src/processes-extension.ts:39` copies the `JOB_SCOPE` regex rather than importing it from `@arthur/core/inside-job`, which its test does import. Two copies can drift apart.
- (minor) `test/structure.test.ts`: the core line budget goes from 7039 to 7041. That raise needs to show in the merge's outcome.md.
- (minor) The fix changes the scope's name for every continue instead of waiting for the old scope to unload. That is one of the two options the ticket allows, and updating every reader of the old name is the right reason for the wider scope.

## Checks
- `npm run check` (`tsc`): passed, no errors.
- First `npm test`: completed, but my filter printed only progress lines, no totals.
- Second `npm test`: 1457 tests, 1393 pass, 0 fail, 0 cancelled, 64 skipped (the real-systemd and tmux tests), exit 0. The structure test passed, with only existing yellow files listed, none changed by this branch.
- Read the code: the `continue` file is written before `launch` (`job-control.ts:126`), so the first run keeps `arthur-job-<id>.scope` and every continue gets the timestamped name. The new fake-`systemd-run` test in `job-control.test.ts:465` checks both names, so making the name always or never timestamped would fail it.
- Not run: `npm run mutate`, hand mutations, and the 30 runs of `job-control.test.ts`. I skipped them to stay within the small budget.

FAIL