# AR0121 - Review 1

- Job: 2026-10-18-review-ar0121-job-state-2fffc67e
- Branch: h/2026-10-18-ar0121-job-state-123cb6fe
- Commit reviewed: 867ea97d54f5e58ad26796f123a2e7791be9c3fc
- Verdict: PASS

## Final message

## Review Summary

**Scope**: Entry 27 (job state in coordinator/channels) — context's "Jobs not ended" section, wake's blocked-question line, blocked-on-owner notice with once-only marker, footer by-state counts, plus `since` exposed on `host.jobs.list()` and the F2 (AR0120) README/mmd bookkeeping.

### Verification performed

- `npm ci`, `npm run check` (exit 0), `npm test` (423/423 pass) — reproduced in this worktree, matching the worker's claim.
- Read full diffs of `blocked-notice.ts`, `context.ts`, `inbox.ts`, `job-records.ts`, docs, README/`arthur.mmd`, and `job-states.test.ts`.
- **Mutation testing** (each applied, run against `job-states.test.ts`, then reverted and tree confirmed clean):
  1. Removed `{ flag: "wx" }` exclusivity on the marker file → caught (duplicate notice).
  2. Disabled the surrogate-pair guard on the 4096-cut → caught (character split).
  3. Dropped the `reason.startsWith("user: ")` filter (let dependency blocks notify) → caught.
  4. Inverted `ORDER` (`idle, working, blocked`) → caught in both the context-section test and the footer test.
  5. Removed the footer's `running.has(job.id)` filter → caught (showed ended/out-of-run jobs).
  6. Removed the `state !== "ended"` filter in `context.ts` → caught ("no unended job" test failed).
  7. Zeroed out the wake's `asks` extraction → caught (wake text mismatch).
  8. Disabled the 7-day marker cleanup → caught.
  9. Dropped the event-time component from the marker filename (keyed by `seq` only) → caught (cut-log-replay test failed).
  All nine mutations named in the worker's final message reproduce as failures; none is a tautology or happy-path-only check.
- Confirmed `since` already existed in `job-state.ts`/`job-record.ts` (zero diff there); this branch only exposes it through `JobRecord`/`host.jobs.list()` — matches the "no core lines added" claim (net-neutral edit, not a budget change; core budget stayed 4649).
- Confirmed orchestration line budget: `cat packages/orchestration/src/*.ts | wc -l` → 875, matching `BUDGETS.orchestration` in `structure.test.ts`; every file ≤ 200 lines; the ticket got a Decision line recording the coordinator's acceptance of the raise, per the project's own convention.
- Confirmed no quiet-hours gating exists in `blocked-notice.ts` (`grep` empty) — correct per roadmap text ("channel's rule", out of scope here).
- Confirmed README/`arthur.mmd` now show "23 to 27 built" (covers entry 25 per the AR0120 F2 decision) and a bonus accurate fix to a pre-existing stale comment about the `machines` plugin (that plugin was already merged before this branch's base — `cf1feb0` is an ancestor of `66a6a42`), not scope creep that introduces anything false; `test/readme.test.ts` ("mermaid block is arthur.mmd, unchanged") still passes.
- Docs (`coordinator.md`, `jobs.md`, `roles/coordinator.md`) read accurately against the code's actual ordering/behavior (context section order, footer format, "Jobs blocked on the owner" section, dependency-block exclusion).
- `findings.md` F1 is correctly scoped "open"/out-of-ticket (pre-existing inbox event-number collision risk after a hand-cut log); not something this ticket's Done-means requires fixing, and the branch's own notice marker correctly avoids the same hole by keying on `seq-time`.
- No plugin-boundary violations (all new imports stay within `@arthur/core` or same-package files), no runtime deps added, no class/enum, no production resource names in tests, English only.

### Notes (non-blocking)
- The `machines`/mmd-comment correction is outside the literal ticket Decision text (which names only entry 25) but is a small, accurate, same-file fix adjacent to the touched README/mmd lines — acceptable per styleguide's "small refactor that keeps behavior identical" allowance.

### Checks run
- `npm run check`: exit 0.
- `npm test`: 423 tests, 423 pass, 0 fail (full run, ~204s).
- `node --import @arthur/core/testing --test packages/orchestration/test/job-states.test.ts`: 9/9 pass baseline; 9 targeted mutations, each caught.
- `git status --porcelain` after mutation testing: clean (no leftover edits).

No requirement from entry 27's Delivers/Done-means is missing, stubbed, or only claimed; the budget raise is justified and tight; the once-only marker and UTF-16-safe cut both hold under adversarial mutation; README correctly reflects entry 25.

PASS
