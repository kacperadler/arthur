# AR0621 - Review 1

- Job: 2026-11-04-review-8c63beff
- Branch: arthur/2026-11-04-worker-a5aa7883
- Commit reviewed: 2fdc1d2f48d3a05580f706d49329208a153da1b3
- Verdict: PASS

## Final message

**Verdict: PASS.** AR0621 is done on `2fdc1d2f`: both Done-means points are met, each new line has a test that fails without it, and `npm run check && npm test` pass.

## Findings
None that block the merge.

- **Pins:** `packages/core/src/git-config.ts:41` now always includes `-c core.useReplaceRefs=false` in the pins. Moving `protocol.ext.allow=never` from the end to the front changes nothing Git reads. That key is never in the owner map, and `credential.helper=` still comes before the owner's helpers.
- **Job environment:** `packages/core/src/wrapper.ts:124` (install) and `:132` (agent) set `GIT_NO_REPLACE_OBJECTS=1`. They use the same path that already carries `npm_config_cache` and `ARTHUR_JOB`, so a reviewer job gets it too.
- **Test kit:** `test-env.ts` clearing `GIT_NO_REPLACE_OBJECTS` is a needed knock-on change: without it, a job's own `npm test` would break the AR0615 test, which reads a replacement on purpose.
- **Out-of-scope file:** the worker explains the change to `spawn.md`: it is the doc page for this behaviour.
- **Docs:** I searched `docs`, `packages`, `README.md` and `spec/roadmap.md` for `protocol.ext.allow`, `useReplaceRefs` and `GIT_NO_REPLACE_OBJECTS`. `docs/deploy.md` now names both mechanisms and drops the old "only until the next check" race for Arthur's checked calls. No stale line remains.
- **Bypass check:** a job can drop the variable in its own shell (`env -u`), but that only affects its own git. Each reviewer gets a fresh environment from the wrapper, and the variable overrides any repository config. Grafts are excluded by the ticket's Out.
- **Worker's F1:** this is an owner question under AR-D498, not a failure of this branch. The new `findings.md` describes it without naming the client.

## Notes
- (risk) `packages/core/src/wrapper.ts:124`: only a job's install and agent get `GIT_NO_REPLACE_OBJECTS=1`; the checks `arthur merge` runs on main do not. The Scope names only the job's environment, and Arthur's own merge git calls already pass `--no-replace-objects`.
- (minor) `packages/core/src/wrapper.ts`: still 217 lines (yellow), the same as at the base, so this branch did not move it there.

## Checks (on `2fdc1d2f`)
- **`npm run check && npm test`** (one call, 1800 s timeout): `tsc` passed, but the test output went through a filter that did not show the summary. So I ran `npm test` again on its own: exit 0, 1538 tests, 1474 pass, 0 fail, 0 cancelled, 64 skipped.
- **`npm run mutate`**: killed at the 1800 s timeout, so it gave no result. I did the mutations by hand instead, each restored with `git checkout --`; `git status` was clean afterwards:
  - Removed `"-c", "core.useReplaceRefs=false"` from the pins: `git-config.test.ts` failed 2 tests ("the shared config: undone after the check, read past by the pins").
  - Removed `GIT_NO_REPLACE_OBJECTS: "1"` from the agent's environment: the AR0621 test in `sandbox.test.ts` failed with `agent` (`planted` read instead of `first`).
  - Removed `GIT_NO_REPLACE_OBJECTS=1` from the install command: the same test failed with `install`.

PASS