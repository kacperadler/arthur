# AR0015 - Review 1

- Job: 2026-10-16-review-ar0015-job-limits-70284b52
- Branch: h/2026-10-16-ar0015-job-limits-time-a-b27f47ad
- Commit reviewed: 58ab7b35a91b61ec5abbb6d805f2170a40963ea1
- Verdict: PASS

## Final message

No blocking issues found. Summary of verification performed:

**Checks run (in this worktree, range 856b8c2..58ab7b3):**
- `npm ci`: clean.
- `npm run check` (tsc): clean, matches worker's claim.
- `npm test`: 221/221 passed, matches worker's claim (verified `limits.test.ts`'s 13 new tests individually ran and passed).
- `wc -l`: confirmed `jobs.ts` = 200 lines, `wrapper.ts` = 198 lines, as claimed.

**Mutation testing** (throwaway edits, restored with `git checkout --` after each, tree confirmed clean at end):
- `reached()`: dropped the 4-decimal rounding → caught (`budget: a sum floating point…` test times out/fails).
- `reached()`: dropped `budget > 0` guard → caught (budget-0-means-none test fails, state `limit: budget` instead of `done`).
- `deadline()`: dropped the `minutes > 0` guard → caught (timeout-0 test fails, state `limit: time` instead of `done`).
- wrapper.ts: dropped `resumes === "true"` gate → caught (`review` kind, which doesn't ask for resume, gets resumed — budget field wrong).
- wrapper.ts: dropped `!late` gate → caught (job resumed despite its time having run out; budget doubles when it shouldn't).
- spawn-command.ts: disabled the `AMOUNT` regex check → caught (exit code 1 instead of 2, error message from the deep `checkLimits` check instead of the CLI usage message — and would miss `1e3`/`Infinity` entirely, which `checkLimits` doesn't catch since they parse to finite numbers).

Each of these corresponds to an edge case named in roadmap entry 12's Done means or the ticket's Decisions, and each has a dedicated assertion that fails under the mutation — no silent gaps found.

**Against the ticket / roadmap entry 12:**
- Precedence spawn > kind > core.jobs, explicit `0` kept: implemented in `spawnLimits`, tested directly.
- Refused before any worktree/record exists: `spawnLimits`/`checkLimits` run before `newJob`/`addWorktree` in `jobs.ts`; CLI-level `AMOUNT` check runs before `jobs().spawn()` is even called.
- Budget boundary at 4 decimals, mid-tool-call time stop, whole process group, first-limit-wins, resume once/never twice/only for asking kinds, long-timeout chunking past the ~24.8-day Node timer cap: all present and each has its own test using the fake agent and `until()` waiting on the actual asserted state (file content / `job-ended` event), not a fixed sleep.
- Final states `limit: time` / `limit: budget`: matches the ticket's explicit 2026-10-16 Decision referencing entry 32's `limit: memory` precedent.
- Resume via `omp --continue`: explicitly deferred to post-merge smoke by the ticket's own Decision; worker's final message correctly flags this as `[INFERENCE]` rather than claiming it verified.

**Line-budget note (not a blocker):** `jobs.ts` (200) and `wrapper.ts` (198) are at/near the per-file 200-line cap (package-level budget for core is 4000, far from binding). Reviewed `wrapper.ts` for extractable chunks: the resume/timeout/budget state machine is tightly closed over wrapper-local `note`/`save`/`play`/`child`, and the args-builder is CLI-flag logic unrelated to the `job-limits.ts` domain — pulling either out now would be speculative module-splitting for a single caller, which the styleguide's "avoid abstracting before the second example" counsels against. The code is reasonably the least that works for this ticket; the headroom problem is real but is AR0022's problem to solve when it lands (extract something then), not a scope violation here. Worker surfaced this correctly and did not silently let AR0022 break.

**F1 finding** (SIGTERM-only stop, reproduced by a real test with `trap '' TERM`): correctly filed as `open` in `findings.md` per the project's template, correctly scoped out (entry 14 owns SIGKILL-after-grace), not a requirement of entry 12's Done means.

**Other:** `cli.ts`/`spawn-command.ts` split is a clean, behavior-preserving extraction (same pattern as `roles-command.ts`); `spawn.test.ts` updated appropriately (replaced the now-stale "`--budget` is unknown flag" case with a genuinely-unknown `--project-x` case, added coverage for the new flags) — no test coverage was deleted to narrow scope. Docs (`spawn.md`) fully describe the new flags, record keys, limit states, resume mechanics and refusals, matching the implementation. No runtime dependency added, no banned filenames, no class/enum, boundaries (core-only, no plugin imports) untouched.

PASS
