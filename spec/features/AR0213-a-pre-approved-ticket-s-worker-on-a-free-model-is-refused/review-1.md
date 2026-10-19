# AR0213 - Review 1

- Job: 2026-10-19-review-ar0190-core-batch-32330177
- Branch: h/2026-10-19-ar0190-core-batch-2-27eddfc2
- Commit reviewed: a2fd7aac860acc691af31ef03d104af7b966b86a
- Verdict: PASS

## Final message

Clean, all mutations restored.

## Review Summary

**Scope:** Tickets AR0213, AR0161, AR0169, plus AR0190's deferred "option a" (continue re-runs prepares) and its prerequisite `jobs.ts` split — all explicitly hosted/decided under AR0190 per the tickets' own `Decisions` sections and the task's Focus paragraph, so in scope despite the instruction's `Tickets:` line only naming three paths.

**Verification performed:**
- `jobs.ts` split (`0bef133`): diffed base vs. split commit — `Kind` type moved verbatim into `job-kinds.ts`, only import rewiring and one `setNow` one-liner elsewhere; confirmed 185/37 lines at that commit. Pure move, as claimed.
- AR0213 (`b7d1ab6`): `Spawn.free` threaded from `pickModel` → `Spawn` → `writeRecord`/`recordedJob` → `plans.ts`'s `overBudget`. Mutated `(budgetUsd > 0 || free)` back to `budgetUsd > 0` — new test failed as expected; restored.
- AR0190 (`e26c467`): `continueJob` now builds the full `Job` via `recordedJob`, runs `beforeSpawn` and `prepare` (with `continued=true`) against it; env goes to `launch`/`remote-job continue` stdin, never the record (confirmed via secret-absence assertions in `model.test.ts` and `machine.test.ts`). `hook.ts`/`install.ts` return at once on `continued` — mutated the early-return guard in `hook.ts`, `commit-rules.test.ts` caught it (git config changed); restored. Remote path sends precomputed env over SSH stdin, no re-exec of prepares remotely — correct per docs and `remote-job.ts`.
- AR0161 (`6b40b5f`): `host.code` now built from `packageOf(fileURLToPath(plugin.module))`, deduped via `Set`; `module` validated as `file:///…` at load. All 11 plugins set `module: import.meta.url` (grep-confirmed). New `host.test.ts` case covers dedup across two modules in one external package, a plugin with no module, and the non-`file:` refusal. Root `option-tables.test.ts` cross-checks every real plugin's `module` resolves to its actual package folder.
- AR0169 (`a2fd7aa`): `run` is a third kind in `register.ts` (mutually exclusive with `action`/`job`, validated), executed in `sweep.ts` only after the same `claim()` slot-lock used by jobs/actions — reusing the already cross-process-tested claim primitive. Mutated `runs.push(...)` to a no-op; the new test timed out waiting for the failure notice, confirming it's exercised. `list` line and failure-as-notice format verified against the test.
- `findings.md` F1 (AR0161) is accurately scoped: `register.ts`'s own `code.slice(1).find(basename === plugin)` lookup is unchanged, still name-based — correctly left open, not silently fixed or hidden, and not required by AR0161's ticket (which only governs `host.code` construction, not this consumer).
- Line-budget math: `core` src = 5490 exactly matches `BUDGETS.core`; `schedule` = 570; all other 10 plugins each exactly budget. Comments in `structure.test.ts` explain each line delta plausibly.
- Ran `npm ci` (clean), `npm run check` (clean tsc), `npm test` in this worktree: **716/716 pass**, matching the worker's claim exactly.
- All 5 commits carry `Signed-off-by` and Conventional-Commits scope by ticket id; AR0190 is split into a refactor + fix commit rather than one, a minor deviation from "one commit per ticket" but a reasonable mechanical/behavioral split, not hiding anything.

**Notes (non-blocking):**
- AR0190 got two commits instead of one; justified (prerequisite structural move vs. the behavior fix) and both correctly scoped/signed.
- Budget raises and AR0169's `run`-kind choice were already pre-approved in the tickets' own `Decisions` sections, so the worker's "needs from coordinator" flagging is just an FYI, not an open blocker.

No requirement is missing, stubbed, or only claimed; no boundary violation found; no secret exposure; no production-resource collision; all claimed checks reproduced exactly.

PASS
