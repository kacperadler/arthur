# AR0110 - Review 1

- Job: 2026-10-17-review-ar0110-maxagents-c16142a8
- Branch: h/2026-10-17-ar0110-maxagents-3fea9e09
- Commit reviewed: a904350fb604aaf04f2e86f09a783aac71ec0ce6
- Verdict: PASS

## Final message

Tree is clean, no leftover mutation edits.

## Findings

None that block merge.

## Notes (non-blocking)

- `packages/core/docs/commands/continue.md:25` still enumerates the record fields a `beforeSpawn` check sees as "`task`... `kind`, `project`, `model`, `thinking`, `timeout`, and the `--budget`...", omitting the new `quick` field that `job-control.ts`'s `continueJob` now passes into the same check object. Cosmetic: the generic "refused by `<plugin>`: `<reason>`" clause still correctly describes behavior (including a maxAgents refusal on continue, confirmed by the test at `packages/core/test/job-control.test.ts:455`), and no check reads `quick`, so nothing is actually misdescribed about behavior — just an incomplete field list.
- README's orchestration status row ("1 of 8 entries", "24 to 29, 65") is unchanged and now stale (entry 26 landed), but this line was already stale before this branch — AR0084 (entry 24) didn't update it either (checked via `git show a41bcb6:README.md` vs its parent). Not a convention this branch broke.
- The two "decisions to approve" the worker asks about (line budget 658→690, maxAgents default 3, `roles.quick: { model }` as `--smol`) are already pre-approved verbatim in the ticket's own Decisions section (2026-10-17 entry), so no actual open decision remains.

## Checks run (in this worktree, not the main checkout)

- `npm ci`: installs clean.
- `npm run check`: passes, no tsc errors.
- `npm test`: 385/385 pass, 0 fail — matches worker's claim exactly.
- Line budget: `wc -l packages/orchestration/src/*.ts` → 690, exactly matching the new `BUDGETS.orchestration` in `test/structure.test.ts`; the diff that produced the +32 is almost entirely the new, necessary `spawn-rules.ts` (24 lines) plus small touches to `orchestration.ts`/`orchestration-options.ts`/`coordinator.ts` to wire it — no padding.
- **Mutation 1** (Focus: maxAgents refusal): removed the `running.length < max` check in `spawn-rules.ts`, ran `packages/orchestration/test/spawn-rules.test.ts` → exactly 4 of 8 tests failed (the maxAgents-named ones), matching the worker's claim verbatim. Restored via `git checkout --`.
- **Mutation 2** (Focus: spawn lock): replaced `queueLock(...)` with a no-op release in `spawn-check.ts`, ran `spawn-rules.test.ts` + `jobs.test.ts` → exactly the two "at once" tests failed ("two spawns at once take turns...", "two spawns at once with one slot left..."), matching the worker's claim verbatim. Restored via `git checkout --`.
- **Crash-safety check** (Focus: "a crash while holding it does not block spawns for good"): wrote a throwaway script that seeds `spawn.lock` with a dead pid (999999, correct boot id) and calls `queueLock` — it acquired the lock in 3ms via `takeLock`'s existing dead-pid takeover, not the 60s timeout. `queueLock` correctly reuses `takeLock`'s already-tested crash-recovery path rather than reimplementing it; confirmed via this script and the pre-existing `lock.test.ts` dead-holder tests that still pass.
- Verified `release()` is called exactly once functionally (idempotent via the `held` flag) at both the right points: after `writeRecord` in `jobs.ts` (spawn) and after `moveJob(... "working" ...)` in `job-control.ts` (continue), with a second call in each `finally` block that is a no-op by design — confirmed by the `lock.test.ts` test asserting a second `release()` call never removes a lock taken since by someone else.
- Confirmed plugin boundaries: `spawn-rules.ts`, `orchestration-options.ts`, `orchestration.ts`, `coordinator.ts` import only `@arthur/core`'s published subpaths (`@arthur/core`, `@arthur/core/plugin`) and sibling files in `orchestration/src/` — no cross-plugin or core-internal-path imports.
- Confirmed backward compatibility for `quick`-less records: `packages/core/test/job-control.test.ts:285` deletes the `quick` file from a spawned job's record before continuing it, and the continue still succeeds without `--smol` in the resumed process's args — matches the worker's claim and `wrapper.ts`'s `existsSync` guard.

PASS
