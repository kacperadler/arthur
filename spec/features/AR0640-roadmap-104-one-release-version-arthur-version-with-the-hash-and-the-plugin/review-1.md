# AR0640 - Review 1

- Job: 2026-11-06-review-aea38531
- Branch: arthur/2026-11-06-worker-3aac4951
- Commit reviewed: 987b4a45dab028643422a0ec721ae92e7c715cd5
- Verdict: FAIL

## Final message

The branch fails on one Done means point: the core line budget was raised from 7239 to 7285, and the worker's final message never names that number. The code itself works and its tests hold.

## Findings

1. **`test/structure.test.ts:14`: the budget raise is not named.** The core's line budget goes from `7239` to `7285`. The ticket's Done means says: "a line budget raised names the new number in the final message (the owner's decision, AR-D514's plan Risks)". The worker's final message only reports the check and test results; it never mentions the raise or 7285. The ticket's Decisions record no approval either. So the owner would merge a +46 budget raise that nothing in the branch's own record shows. To fix it, the worker's message must name `core: 7239 → 7285` so the owner can decide on it.

## Notes

- (bug) `packages/machines/src/machine-check.ts:94`: an online machine is reported with this host's version, not its own. A check that passes still returns `version: ours`. Now that only the hash is compared, a machine printing `9.9.9 <hash>` shows as `ok (linux x64, arthur 0.1.0 <hash>)`, in its `machine-online` event, `arthur machines` and the doctor. This happens for real: a release that only bumps `package.json` keeps the same hash, so a machine left on the previous release would show this host's release. The `next` row in `packages/machines/test/machines.test.ts` (`ok (linux x64, arthur ${arthurVersion()})`) pins this behaviour.
- (minor) `packages/core/src/plugin-range.ts:15`: a core release with a prerelease suffix (`0.1.0-rc.1`) turns into `NaN` parts, so it is always outside a range. No such release exists today.
- (minor) `packages/core/src/plugin-range.ts:9`: `RANGE` accepts leading zeros (`^01.2.3`), which npm's semver rejects.
- (minor) The worker's final message does not list what changed or its commits; it only reports the checks.

## What checks out

- **Version 0.1.0 everywhere:** the root, core and every plugin `package.json`, and the lockfile (24 `"version": "0.1.0"` lines).
- **`arthur version`** prints `<release> <hash>`.
- **Remote checks:** the spawn's `reach` and the machines check compare only the last word, and a refusal names both whole lines.
- **Plugin range at load:** read once when plugins load. It gives a non-critical doctor line; plugins without the field give no line. A test covers `^`, `~` and exact ranges at their limits, and any other range is reported as unread.
- **Hand version bump:** a `package.json` changed by hand on main blocks the merge, shown in `merge.test.ts`.
- **Docs:** the `version`, `doctor`, `spawn`, `machines`, `deploy`, `setup` and `plugin-api` docs are updated, and I found no stale mention left.
- **File sizes:** no changed source file goes past 200 lines.

## Checks run (on 987b4a45)

You asked me not to rerun the full suite, so I ran only targeted checks, plus one mutation by hand instead of `npm run mutate`.

- `node --import @arthur/core/testing --test test/structure.test.ts packages/core/test/plugin-range.test.ts`: 23 tests, 23 pass, 0 fail. The 9 files it lists as yellow are all ones this branch does not touch.
- Mutation by hand: I loosened `/^\S+ (\S+)$/` to `/(\S+)$/` in both `job-machine.ts` and `machine-check.ts`, then ran the three version tests in `machine.test.ts` and `machines.test.ts`. Two of the three failed, so the mutation was caught; the "another release passes" test still passed, as it should. Restored with `git checkout --`; `git status` is clean.

FAIL