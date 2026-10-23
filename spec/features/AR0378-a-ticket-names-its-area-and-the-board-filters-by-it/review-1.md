# AR0378 - Review 1

- Job: 2026-10-23-review-ar0378-ticket-kin-1ef043d5
- Branch: h/2026-10-23-ar0378-ticket-kinds-2c588335
- Commit reviewed: a8571027f9fccec22808ab2243db6925554367d8
- Verdict: PASS

## Final message

Worktree clean, no leftover mutation edits.

## Findings

None blocking. Diff is tightly scoped to the ticket's Scope list (core board/template, orchestration board-commands/autopilot, delivery changelog, findings on-merge, docs, and the 382-file migration).

## Notes

- `spec/features/AR0378-…/findings.md` F1 cites absolute local paths (`/home/kacper/harness/...`); this already matches the existing convention in AR0261/AR0265/AR0311 findings/tickets, so not a new leak.
- Migration edge cases (`plan`→feat for AR0214/AR0216, `gap`→fix for AR0286/AR0287, AR0231 left without a Kind) verified directly in the files and match the final message exactly.

## Checks run

- `npm ci` — clean.
- `npm run check` — passes, no tsc errors.
- `npm test` — 1065/1065 pass (confirmed via full run, matches worker's claim).
- Mutation 1: disabled the `notPlanned` Kind-outside-template refusal in `ticket-template.ts` → `packages/core/test/board.test.ts` failed (`Missing expected exception: bug`), confirming the refusal is tested. Reverted.
- Mutation 2: disabled the "a bare `all`/prefix-match wins over kind" branch in `board-commands.ts` (`own` precedence) → `board-commands.test.ts` failed on the `/board all` vs. project-prefixed-`ALL` case, confirming the precedence is tested. Reverted.
- Spot-checked `board-text.ts`: `openAfter` reads from unfiltered `entries`, not the kind-filtered `listed`, so "waits for" stays correct when filtering by Kind — matches the claimed fix for the filtered-wait edge case.
- Verified templates (`spec/features/_template/ticket.md`, `findings.md`, `packages/core/templates/ticket.md`, `packages/findings/templates/findings.md`) all list exactly the 11 kinds, matching `test/ticket-kinds.test.ts` assertions.
- Confirmed via `grep` that no `ticket.md` Kind line anywhere in the repo still holds an old kind (bug/risk/cleanup/improvement/feature); findings.md internal Kind fields (historical, not tickets) are out of the ticket's stated migration scope and are explicitly guarded against leaking into new tickets via `host.board.kinds`.
- Confirmed line-budget raises in `test/structure.test.ts` (core 5903, orchestration 2320, delivery 1311, findings 253) match both the ticket's Decisions line and the worker's final-message table.

PASS
