# AR0675 - Review 1

- Job: 2026-11-18-review-550282c1
- Branch: arthur/2026-11-18-worker-193ee6d4
- Commit reviewed: e9a00ff26884aecf2d24632f6e678c22868ffd7e
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0675 asks. Delivery now registers only `checks-extension.ts`, which has the one `session_stop` handler: it puts the reminders that are due in one answer, the checks reminder first and the processes reminder after a blank line, and gives each at most once per run (`packages/delivery/src/checks-extension.ts:60-68`, `packages/delivery/src/delivery.ts:118`). Both reminders keep their wording. The doc section "Processes a job leaves running" now says what the code does. The test the ticket asks for is in `packages/delivery/test/processes.test.ts:66-81`: a worker with a process left and no checks passed gets both reminders in one continuation. The once-each rule is tested in both orders, and so is the end after both were given (`checks.test.ts:342-370`). The stale-text search found no doc, role or comment that still describes two registered extensions; the old code appears only in the dated retro snapshots.

## Notes
- (minor) `packages/delivery/test/processes.test.ts:10`: the worker's "fails before the change" result (`pass 1, fail 2`) did not reproduce. With `packages/delivery/src` put back to the base, the whole test file fails when it loads, because the base does not export `leftProcesses` (`pass 0, fail 1`). It still fails before the change, and from the base code and the fake agent's first-answer rule (`answers.find`) the joined-reminder assertion could not pass there.
- (minor) The ticket asks for `npm run mutate -- --max 25`; the worker and I both ran plain `npm run mutate`, which ran all 61 mutants. That covers more than the ticket asks.

## Checks (on `e9a00ff2`)
- `npm run mutate`: `61 mutants, 61 caught, 0 survived`; no mutant was left `not run (time)`.
- `npm run check`: `tsc` clean.
- `npm test`: `tests 1907, pass 1843, fail 0, cancelled 0, skipped 64`. The structure test passes, and no file this branch changes is listed as yellow.
- Hand mutations, each restored with `git checkout`, then `checks.test.ts` and `processes.test.ts` run:
  - processes reminder never marked as given: caught (`pass 21, fail 6`).
  - order of the joined reminders reversed: caught (`pass 25, fail 2`).
- `processes.test.ts` with `packages/delivery/src` put back to the base: fails (`pass 0, fail 1`); the files were restored afterwards and `git status` was clean.

PASS