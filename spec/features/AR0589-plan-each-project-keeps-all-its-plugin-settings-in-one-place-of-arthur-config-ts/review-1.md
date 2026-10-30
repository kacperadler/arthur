# AR0589 - Review 1

- Job: 2026-10-30-review-c8417a5d
- Branch: arthur/2026-10-30-worker-c6b3974c
- Commit reviewed: 5a5ecf12619f38aed09aca3ff6a4d45fc9dd5081
- Verdict: FAIL

## Final message

FAIL: two key behaviours the branch adds can be mutated away and every test still passes. Everything else on your list checks out, and `npm run check` and `npm test` reproduce the worker's figures exactly.

## Findings

1. **`packages/core/src/roles.ts:179`: no test covers the symlink guard for absolute prompt paths.** I changed `(isAbsolute(path) ? path : …)` to `(isAbsolute(path) ? realpathSync(full) : …)`, which turns off the real-path comparison for prompt files read from a project folder. `packages/core/test/roles.test.ts` still passed 13 of 13. The new test (`roles.test.ts:191-207`) only symlinks the file itself, and `lstat` already catches that. The case only the comparison catches has no test for absolute paths: a symlinked folder inside the project folder, such as `projects/shop/criteria` pointing elsewhere. The repository-relative case has this test (`roles.test.ts:135`), the folder case does not. The code is correct today, but this guard stops a job's prompt from reading files outside the project folder. If it broke, nothing would fail. The review criteria count an uncaught mutation of a key behaviour or refusal as a FAIL.

2. **`packages/delivery/src/delivery.ts:42` and `packages/machines/src/machines.ts:37`: removing `after: ["projects"]` breaks no test.**
   - Deleting it in delivery: all `packages/delivery/test/*.test.ts` plus `test/ci-wait-wake.test.ts` still passed, 107 of 107.
   - Deleting it in machines: `packages/machines/test/*.test.ts` still passed, 25 of 25.

   Both lines are new in this diff. Without them, a config that lists delivery or machines before projects sets them up first. At that moment `checkPieces` (`host.ts:72`) would find no project list, so a bad `delivery.project(...)` or `machines.project(...)` would go unchecked without any message [INFERENCE: from how `checkPieces` and `pieced` handle an empty collect; not run]. "Plugins with pieces set up after projects" is a point of this review. A root test with `[delivery(), projects(...)]` in that order and a bad piece would catch it.

## Your points
- **The 62 skipped tests:** I ran only the files that can skip, with TAP output, and grouped the skip reasons. The total is 62, and every reason comes from this job's sandbox, not from the branch:
  - 40: "this host refuses a Unix socket (EACCES), so tmux cannot start a server". These are the orchestration coordinator, inbox and silent tests, plus the tmux tests of the core test kit (`testing.test.ts`).
  - 18: "no systemd user manager". These are in core `job-control`, `machine`, `scope` and `testing`, delivery `merge`, and resources `feature-caps` and `resources`.
  - 4: "this process cannot make a Unix socket itself (it runs in a job's sandbox)", in core `sandbox.test.ts`.
- **Per-project keys:** the `projects.project(...)` keys in `PIECE` are only `prefix`, `path`, `repo`, `title`, `about`, `install` and `prompts`. Each other key moved to its plugin's `.project()` helper with a `piece` check. `chat` and `docker` only changed in text: roadmap 85 and 86, and the example config. The old `list`, `sites` and `mode` options are refused as unknown, with tests at `project-options.test.ts:81`, `uptime-options.test.ts:13` and `findings-options.test.ts:12`.
- **Project file refusals name the file:** every message is built as `${file}: …`, in `project-file.ts` and in `checkProjects`. Disabling the "second piece of one plugin" refusal is caught (1 test fails).
- **Order after projects:**
  - uptime and findings use `after`; delivery and machines now do too.
  - youtrack, github and commit-rules use `requires`.
  - The order itself is untested for delivery and machines (finding 2).
- **Init and onboarding:** both refuse a project whose prompts live in its folder. Mutating `folderPrompts` fails 2 tests; disabling the onboarding refusal fails 1.
- **Absolute prompt paths:** a symlinked file is refused and tested. A symlinked folder on the way is not tested (finding 1).
- **`.gitignore`:** `/projects/` only matches at the root. `git check-ignore` matches `projects/x/project.config.ts` and not `packages/projects/src/projects.ts`.
- **The AR0576 merge:**
  - `pass-forward.ts` and `review-needed.ts` read `pieces?.delivery?.autoMerge`. Putting the old `?.autoMerge` back fails 2 tests and 1 test in `review.test.ts`.
  - The merge's second parent is on main.
  - `delivery.ts` keeps the `start` that starts the pass-forward loop.
- **Line budgets:** I counted each package's `src/` lines with `wc -l`, the core test kit counted separately. Every count equals its budget in `test/structure.test.ts`.
- **Other mutations the tests catch:** removing the `checkPieces` call in `host.ts` (2 fail), inverting the unread-pieces filter for doctor (1 fails), and dropping the `..` check on prompt paths in `project-options.ts` (1 fails).

## Notes
- (minor) `packages/core/test/roles.test.ts:191`: the absolute-path test would be complete with a row like the one at line 135, a symlinked folder inside the project folder.
- (risk) `packages/delivery/src/delivery.ts:42`: if the `after` is lost, any config listing delivery before projects loses its piece checks without a message (finding 2).

## Checks
- `npm ci`, then `npm run check`: tsc clean.
- `npm test`, in one call with an 1800 s timeout: 1395 tests, 1333 passed, 0 failed, 62 skipped, 0 cancelled, 0 todo. This matches the worker's claim.
- The files that can skip, run alone with the TAP reporter: the 62 skips grouped as above.
- 11 mutations, each run against its tests. 9 were caught; 3 survived: `roles.ts:179` (13 of 13 pass) and `after: ["projects"]` in delivery (107 of 107) and machines (25 of 25). Each was restored with `git checkout --`, and `git status` was clean afterwards.
- Line counts measured with `wc -l`: every count matches its budget.

FAIL