# AR0187 - Review 1

- Job: 2026-10-19-review-ar0187-models-31bc32a5
- Branch: h/2026-10-19-ar0187-models-d5226cf4
- Commit reviewed: 2c2fe6a21ddefb9351f359ba488f90b9a543e95c
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

**Findings:** none that block merge.

- F1–F4 in `findings.md` (`arthur continue` skips prepare on provider models; per-process-only probe reuse; Tailscale IPv6 range mismatch with `machines` plugin; doctor checks only the local machine's `models.yml`) are legitimate open gaps the worker found and recorded, none required by entry 82's Done means or Scope (continue behavior, cross-process probe sharing, and other-machine doctor checks aren't named there); correctly left as open findings, not silently dropped.
- Budget accounting is exact: `packages/models/src` sums to 485 lines, matching the declared budget precisely; core/orchestration raises are justified in the structure-test comment and the ticket's Decisions, which the coordinator already accepted.

**Notes (non-blocking):**
- `model-doctor.ts`/`usage.ts` read/write only the plugin's own `host.folder` and omp's external `~/.omp/agent/` config; no cross-plugin `.arthur/` access.

**Checks run (in this worktree, not the main checkout):**
- `npm ci`: clean, 12 packages added.
- `npm run check`: `tsc` clean, no errors.
- `npm test`: 622/622 pass (matches worker's claim).
- GitHub check-runs on `2c2fe6a`: `check` success, `build` success, `deploy` skipped (matches worker's claim).
- Mutation tests (throwaway edits, restored, `git status` clean after):
  - Inverted free-model budget (`free ? budgetUsd : 0`) → `packages/core/test/model.test.ts` catches it (budget `2` vs `0`).
  - Disabled 30 s probe-reuse window (always reuse) → `packages/models/test/models.test.ts` "two picks at once…" catches it (`1 !== 2`).
  - Disabled public-host refusal (`isPrivate` always true) → "refused at load…" catches it.
  - Removed the `Authorization` header line from curl's stdin config → 7 of 14 models tests fail, including the one specifically named "key on stdin and never in an argument."
- Verified `ssh()`/`execute()` write `input` to child stdin, never argv — provider keys never reach argv, logs, or the job record (also directly asserted in tests via `ssh.log` content and record-file scan).
- Verified package boundaries: `@arthur/models` has no `dependencies`, no runtime deps beyond none declared; imports only `@arthur/core`'s published exports (`.`, `/plugin`, `/option-table`, `/testing`); every `src/` file ≤200 lines; structure/boundary tests in the full suite pass.
- Spot-checked edge-case tests for comma-list parsing (`"a,", ",a", "a,,b", "a, ,b"`), OS-chosen loopback ports via `http.listen(0, "127.0.0.1", …)`, fake clock (`fake.setNow`) driving the 30 s window rather than real sleeps.

PASS
