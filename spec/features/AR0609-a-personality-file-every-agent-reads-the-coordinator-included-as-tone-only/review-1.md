# AR0609 - Review 1

- Job: 2026-11-04-review-8bc22b2a
- Branch: arthur/2026-11-04-worker-43c41aa2
- Commit reviewed: 51989a78c9bb04dd5f652af079c02be4f93a039c
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0609 and AR-D464 ask:

- **Coordinator only:** orchestration registers `coordinator` with `personality: true` (`packages/orchestration/src/orchestration.ts:95`). No job role sets the flag.
- **Placement:** `prompt()` in `packages/core/src/roles.ts:140-160` puts the tone section last. It comes after the role, the override, the criteria and the plugins' sections, under the heading "every rule above wins over it".
- **Own file:** `<rolesDir>/<role>.personality.md` replaces the shared file (`roles.ts:129,134`). So a future project agent registered with the flag reads its own file or the shared one without new code.
- **Missing, empty, symlink:** a missing or empty file adds nothing and warns nothing. A symlinked or non-plain file is refused through the same path criteria files use.
- **Tests:** `packages/core/test/roles.test.ts` checks:
  - the coordinator's prompt holds the file once, at the end, from both a spawn and `host.jobs.prompt`;
  - a worker's and a reviewer's prompt never hold it;
  - the own file replaces the shared one;
  - missing, empty, empty-own and symlinked files (both paths);
  - the registration refusal;
  - the `arthur roles` line.
- **Docs:** `roles.md` (item 5, refusals, listing), `coordinator.md` and `spec/vision.md` are updated.
- **Line budgets:** core 7145 → 7153 is covered by AR-D63. Orchestration 2739 → 2740 is explained in the final message. `roles.ts` is 190 lines, still green.

## Notes
- (minor) packages/core/src/roles.ts:134: an empty own file overrides the shared one. An empty `<role>.personality.md` leaves that role with no tone. This is deliberate, pinned by a test, and stated by the worker. The ticket's "replaces the shared one" allows it.
- (minor) packages/core/test/roles.test.ts:309: the test fixture flags `auditor` with `personality: true`. It only exercises the `arthur roles` "none" line, but it gives a job-role name the flag that AR-D464 keeps away from job roles. A made-up role name would read clearer.
- (minor) packages/core/src/roles-command.ts:33: in `arthur roles`, the word `personality` is wider than the column, so its line sits one space out of line with the others. The worker said so.
- (minor) packages/orchestration/test/context.test.ts:155: in the coordinator's context, the tone section is followed by the visions and the board, which come after `host.jobs.prompt`. That meets "after its role, its override and its criteria", but the heading's "every rule above" covers only what comes before it.

## Checks
- `npm ci`, `npm run check` (one call, timeout 1800): tsc clean. Tests 1506: 1442 pass, 0 fail, 0 cancelled, 64 skipped. Matches the worker's numbers.
- I did not run `npm run mutate`; the owner asked me to keep the review cheap. I made two mutations by hand and ran `node --test packages/core/test/roles.test.ts` on each:
  - `role.personality === true ?` → `true ?` (every role reads the tone file): caught, 2 tests fail.
  - the tone pushed into `parts` in place, not held to the end: caught, 1 test fails.
- I restored both with `git checkout -- packages/core/src/roles.ts`; `git status --short` then showed nothing.

PASS