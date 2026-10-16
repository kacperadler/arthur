# AR0017 - Review 1

- Job: 2026-10-16-review-ar0017-stop-conti-e18751a9
- Branch: h/2026-10-16-ar0017-stop-continue-ste-6a96b243
- Commit reviewed: f4074a93de68a32241170239cf4725512a929efc
- Verdict: PASS

## Final message

## Review Summary

**Scope checked:** `7be4ac9f..f4074a93` (commits `f033e93`, `f4074a9`), AR0017 (stop/continue/steer) + AR0053 (SIGKILL after grace) done together as instructed.

### Verification performed

**Automated checks (run in this worktree, not the main checkout):**
- `npm ci` — clean.
- `npm run check` (`tsc`) — clean, no errors.
- `npm test` — **244/244 pass**, matching the worker's claim exactly.
- `find packages/core/src -name '*.ts' | wc -l` → **3805** lines, matching "3805 of its 4000" claim; `test/structure.test.ts` confirms `BUDGETS = { core: 4000 }` — unraised. Each new/changed file individually ≤200 lines (`wrapper.ts` 155, `jobs.ts` 194, others well under).
- `pgrep` after the full suite run: no stray job-control-related processes (sleep/omp/trap-TERM scripts) left behind; only unrelated harness/coordinator processes.

**Mutation testing (5 key behaviors, each reverted after):**
1. Disabled SIGKILL-after-grace in `stopGroup` → caught by both `limits.test.ts` (AR0053) and `job-control.test.ts` (AR0017).
2. Removed the no-resume-after-stop guard (`!final`) → caught by "a stop that comes while a limit stops the job... not resumed at its budget".
3. Inverted the "agent had ended already" guard → caught by "a stop that comes once the agent exited on its own leaves the job's own ending".
4. Gutted `closeSteers`'s undelivered-move logic → caught by two tests (undelivered-move test and the CLI end-to-end test).
All mutations were caught by existing tests; restored via `git checkout --`.

### Findings
None that block merge.

### Notes (non-blocking)
- `continueJob`'s wait for a still-exiting old wrapper (up to `GRACE_SECONDS`, to dodge the `systemd-run` duplicate-scope-name refusal) has no automated test — only "checked by hand" per the worker. Hard to make deterministic without flakiness; acceptable given it's defensive and documented.
- F1–F3 in `findings.md` are real, correctly scoped-out gaps (continue skips `beforeSpawn`, held-pipe stall, double-continue race) — properly disclosed as `open` findings rather than silently left or papered over.
- "What happens if the wrapper itself is SIGKILLed" (Focus question): the agent (now in its own process group) is not directly supervised by anything at that point; if under a systemd scope it stays in the scope's cgroup until something else acts (roadmap entry 15's sweep, not yet built); if bare, it is a true orphan. This is consistent with the ticket's explicit scope (entry 14 + AR0053 only) and not a listed Done-means edge case — not a regression, and correctly deferred.
- Docs (`stop.md`, `continue.md`, `steer.md`, updated `spawn.md`/`help.md`/README/deploy.md) accurately reflect the new wrapper-pid-vs-agent-group model; cross-checked against code and found consistent.

### Boundary / styleguide check
All new files (`job-stop.ts`, `process-table.ts`, `run-record.ts`, `node-modules.ts`, `steer.ts`, `steer-inbox.ts`, `job-control.ts`, `job-commands.ts`) stay within `@arthur/core`, no plugin touched, no classes/enums/barrels, no new runtime deps, plain functions throughout.

No requirement from the ticket, AR0053, or the roadmap's entry-14 Done-means is missing, stubbed, or only claimed. Checks and worker's claims reproduce exactly.

PASS
