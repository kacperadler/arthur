# AR0488 - Review 1

- Job: 2026-10-28-review-90db2ce5
- Branch: arthur/2026-10-28-worker-a42d9055
- Commit reviewed: bfbb13498c99c35b29aed7dd45173f9148c5ceec
- Verdict: PASS

## Final message

The branch closes F7 as the ticket asks, every protection it adds is caught by its test, and the checks pass. No findings block the merge.

## Findings

None.

## Notes

- `packages/manage/src/health-checks.ts:31-35`: `git()` now calls `configRefusal(path)` and then runs Git with `--no-replace-objects -c core.hooksPath=/dev/null -c core.fsmonitor=false`. This is the same pattern as `merge-command.ts:86-88`, `take-main.ts:52-54` and `job-machine.ts:145-148`, and `@arthur/core/git-config` is a published export, so no boundary breaks.
- Ways around the fix that I checked: `core.fsmonitor` or `core.hooksPath` set in `.git/config` or `config.worktree` are overridden by the `-c` flags. Programs in files the repo config includes (`[include]`, `includeIf`) are listed as local scope, so `configRefusal` still refuses them. A config changed between the refusal and the git call is the same race every other caller of this pattern accepts.
- The refusal check runs before every git call, so `unpushed` can start up to three extra `git config --list` processes per project per health run. Cheap; just taste.
- Behaviour change, which the worker reported: a project folder that is missing now gives `manage: the commits of <project> could not be checked: git config --list in <path>: fatal: …`, where the main-branch check used to say nothing. The board check already reported a missing folder, so this is consistent.
- `packages/manage/test/health-checks.test.ts` is now 202 lines. The 200-line rule (`test/structure.ts:60-63`) counts only `src/`, so this breaks no rule.
- Docs are updated in `docs/deploy.md` and `packages/manage/docs/commands/health.md`; the labels in the doc ("the commits of", "the board of") match `ownHealth`. The budget goes from 928 to 931 for 3 added source lines, which matches decision AR-D274 in the ticket on main.
- My own slip: while stopping my first test run, which the harness had moved to the background, I ran `pkill -n -f "npm test"`. That signals the newest matching process for my user, so it may have stopped another worktree's `npm test` rather than mine. The cwd of the other test processes was unreadable, so I could not tell which one it hit.

## Checks

- `npm ci`: exit 0.
- `npm run check` (tsc): exit 0.
- `npm test`, with output to a file in the worktree (since deleted): tests 1258, pass 1196, fail 1, skipped 61, exit 1.
  - The one failure is `packages/core/test/limits.test.ts:135` ("a timeout during a long tool call…"): `timed out waiting for the tool's process`. At least three other full test runs were going at the same time.
  - The first try, the one that went to the background, I stopped myself; its mass failures come from that stop, not from the branch.
- `node --import @arthur/core/testing --test packages/core/test/limits.test.ts` on its own: 18 of 18 pass. So the failure above is load, not this branch, as the worker reported.
- The new test against the base version of `health-checks.ts`: 1 fail, 9 pass. It fails before the fix.
- Mutations, each run on `packages/manage/test/health-checks.test.ts` and restored with `git checkout --` (the tree is clean afterwards):

| Mutation | Result |
|---|---|
| Remove `-c core.fsmonitor=false` | 1 fail (caught) |
| Remove `-c core.hooksPath=/dev/null` | 1 fail (caught) |
| Remove `--no-replace-objects` | 1 fail (caught) |
| Remove the `configRefusal` throw | 1 fail (caught) |
| Invert the refusal condition | 4 fail (caught) |

- The worker's claims all match what I saw: check exit 0, timing failures only in `limits.test.ts` that pass on their own, the four mutations caught, and the three commits listed.

PASS