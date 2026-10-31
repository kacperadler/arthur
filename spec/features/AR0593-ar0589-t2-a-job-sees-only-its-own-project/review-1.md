# AR0593 - Review 1

- Job: 2026-10-31-review-eb459888
- Branch: arthur/2026-10-31-worker-e0b23183
- Commit reviewed: 13a7a9961f697ac107db6cbe282bb2249816e2f4
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0593 and the plan's ticket 2 ask: a job loads only its own project, and its sandbox hides the other projects' checkouts, folders and job worktrees. The tests catch each guard I removed.

## Notes
- (security) `packages/core/src/job-sandbox.ts:85`: `otherProjects` reads `project`, `worktree` and `root` from the job's record folder, which the agent can write. An agent that rewrites `project` gets another project unhidden on its next run (a `continue`). This is the worker's F1 in `findings.md`. The weakness was already there before this change; it is not something this branch adds. I did not try a forged record.
- (risk) `packages/core/src/job-sandbox.ts:81`: the core reads `<home>/projects/checkouts` and `folders`, which are the projects plugin's files. The approved plan names this, and `job-place.ts` already reads `checkouts`. It is still core code depending on one plugin's file layout.
- (minor) `packages/projects/src/projects.ts:50`: the job's project is matched by `basename(resolve(each))`. This agrees with how `project-file.ts:55` names a project (`basename(folder)`), but a folder entry like `.` would give the wrong name.
- (minor) `CHANGELOG.md` is not edited, though the plan lists it. The worker says `arthur changelog` generates that file, which is a fair reason.
- (minor) The plan's check "the prompt holds no shop2 text" was left out. The worker's reason (the prompt never reads the project list, so the check could not fail) is credible.
- (minor) `test/structure.test.ts`: line budgets go from 6571 to 6600 for core and from 556 to 564 for projects. The plan's estimates were about 6575 and 570. These raises should show in the merge's outcome.md.

## Checks
- `npm ci`, then `npm run check` and `npm test`, in one call with a 1800 s timeout. `tsc` was clean. That call's summary did not print: my output filter matched nothing and made it exit 1, so I ran `npm test` again on its own: 1404 tests, 1342 passed, 0 failed, 62 skipped. This matches the worker's numbers.
- `node --test packages/core/test/sandbox.test.ts`: 20 passed, 0 failed, 4 skipped. The new AR0593 test ran here; it was not skipped.
- Each mutation below made its test fail, and each file was restored with `git checkout --`:
  - `job-sandbox.ts`: dropping the worktrees from the hidden candidates failed the AR0593 sandbox test.
  - `job-sandbox.ts`: changing the own-path check from `===` or `startsWith` to `&&` failed the AR0593 sandbox test.
  - `projects.ts`: writing the `checkouts` and `folders` lists inside a job too (`if (job === undefined)` changed to `if (true)`) failed one test in `projects.test.ts`.
- The plan was checked at 245bd882. Ticket 2's files, behaviors and tests all match it, apart from the two worker departures above, both of which have reasons.

PASS