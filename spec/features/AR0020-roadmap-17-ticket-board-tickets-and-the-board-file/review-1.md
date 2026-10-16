# AR0020 - Review 1

- Job: 2026-10-16-review-ar0020-ticket-boa-d4c8380d
- Branch: h/2026-10-16-ar0020-ticket-board-ee737520
- Commit reviewed: d2851f87dc1b5f86ced3f466fb6a554d0dae16bd
- Verdict: PASS

## Final message

Worktree clean, no leftover artifacts from smoke test (used mktemp, removed).

Summary of review.

**Findings:** none that block merge.

**Notes (non-blocking):**
- `packages/core/src/ticket-template.ts:19-24` `slug()` silently drops non-ASCII letters (e.g. "Café" → "caf-life"-style loss) with no dedicated test; not a correctness bug since the ticket id (not the slug) guarantees folder uniqueness, and the same code path is already exercised by the "no letter or digit" test case. Would be nice to have an explicit unicode-title test, but omission doesn't meet the FAIL bar (no behavior goes untested that a mutation would expose).
- `spec/features/AR0020.../findings.md` F2 (lock/tmp files under tracked `spec/`) is correctly left open and out of scope; not a regression, just a known risk for a later ticket (41/42) to close.

**Checks run (in this worktree, against `ea08027..d2851f8`):**
- `npm ci`: 5 packages added, no errors.
- `npm run check`: `tsc`, exit 0, no errors.
- `npm test`: 124/124 pass (108 pre-existing + 16 new: 14 board tests, 2 CLI tests).
- Mutation testing on `board.ts` (throwaway edits, each reverted with `git checkout`):
  - `refuseGuidance` turned into a no-op → caught (`planned is refused for a ticket whose ticket.md is gone…` fails).
  - Dropping `isAbsolute` check on project `path` → caught (`project list is checked…` fails).
  - Folder scan for id numbering disabled (`folders = []`) → caught (`ids continue after a dropped ticket…` fails, got DM0005 expected DM0010).
  - Same-status short-circuit removed from `move` → caught (board rewritten when it shouldn't be).
  - (One exploratory mutation — filtering `dropped` entries before computing `lastNumber` — was masked by the independent folder-scan fallback; not a real gap since both signals are intentionally redundant per the ticket's Done means "ids continue after a dropped ticket... or a ticket folder.")
- Independent smoke test in a scratch temp folder (not `npm test`'s harness): `ticket all` on empty board → "the board is empty"; `ticket new` → created `RV0001` with templated `ticket.md`; `ticket status RV0001 planned` → refused, listing all 7 guidance comments verbatim. Scratch folder removed after.
- Confirmed `git status --porcelain` clean before and after review (no stray state).
- Verified boundary/shape rules via the passing structure-test suite (`the repository keeps every rule`, plugin/core import-boundary tests, line-budget test) — all new files well under 200 lines (max 146), core package far under its 4000-line budget.
- Confirmed minimal footprint on shared files: `cli.ts`, `host.ts`, `plugin.ts`, `testing.ts` diffs are small and strictly additive (new import + wiring `host.board` / CLI command registration), matching the instruction to touch them "only where the ticket needs it".
- Design-call in the worker's final message already matches the ticket's recorded Decision (2026-10-16, coordinator OK), so nothing outstanding there.

PASS
