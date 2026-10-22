# AR0284 - Review 1

- Job: 2026-10-22-review-ar0284-decision-c-caba7b1f
- Branch: h/2026-10-22-ar0284-decision-classes-3454afe5
- Commit reviewed: 686648e2b804ac979a9624f47e8b71b1441bb120
- Verdict: PASS

## Final message

Clean. Final assessment below.

**Findings:** none blocking.

**Notes (non-blocking):**
- `spec/features/AR0284-roadmap-97-decision-classes/findings.md` F1 (open): a job's question answered by policy still shows the owner the raw `<job> asks [id]: …` notice; coordinator/wake text says it was decided, but the phone notice doesn't. Correctly filed as an open finding, not required by entry 97's Done means.
- `decision-log.ts` lands exactly at the 200-line budget (no plugin-wide overflow beyond the ticket-approved 2194 total).

**Checks run (in this worktree, against `21c14c41..686648e`):**
- `npm ci` — installs clean.
- `npm run check` (tsc) — passes, no errors.
- `npm test` (full suite, 993 tests) — 993 pass, 0 fail. Matches worker's claim (992 before last commit + 1 new test in the last commit).
- Targeted mutation tests on `packages/orchestration/test/decisions.test.ts` (fast, 25 tests, ~3s):
  1. Allowed `byPolicy` to answer when 2+ classes match (`matched.length === 1` → `>= 1`) → caught (owner-routing test fails).
  2. Disabled the "answer given by policy" refusal in `decision-log.ts` → caught.
  3. Let a revoked/refused class keep answering by policy (`state === "approved"` → `!== "proposed"`, then isolated to `"revoked"` alone) → caught both times, including the specific "a question after the revoke goes to the owner" assertion.
  4. Disabled "a class never approves a class" (`kind === CLASS` check) → caught (wrong error message, still refused via KINDS check, but assertion catches it).
  5. Disabled the hand-edit "only the owner approves a class" check in `classProblem` → caught.
  6. Let `ticketKind` be assigned even when backing decisions' tickets disagree (`kinds.size === 1` → always) → caught ("AC-D3 has no ticket" assertion fails).
  All six mutations of key refusals/edge-cases were caught by the existing tests; worktree restored via `git checkout --` after each.
- Verified `docs/plugin-api.md` diff is empty (claim: no new host member) — confirmed, 0 lines changed.
- Verified `test/structure.test.ts` budget raise (1991→2194) is recorded with reasons and matches `spec/features/AR0284.../ticket.md`'s Decisions entry (coordinator accepted 1991→2194 and the three worker picks).
- Line counts: `decision-class.ts` 67, `decision-classes.ts` 75, `decision-commands.ts` 159, `decision-hooks.ts` 52, `decision-log.ts` 200, `decision-views.ts` 53 — all ≤200, no new `index.ts`/`types.ts`/`utils.ts`, no classes/enums introduced.
- Confirmed no cross-plugin imports: `decision-class.ts`/`decision-classes.ts` only import from within `packages/orchestration/src/` and `@arthur/core/plugin`.
- Manually cross-checked every Done-means refusal/edge case named in the ticket against the test diff (propose refusals: no backing/unknown/unanswered/differing/own-kind; approval-by-policy refused; revoke-of-non-class/already-revoked refused; refused class still asks owner; two-class match names both; question-after-revoke goes to owner; later-answer-counts; ticket line names class never owner) — each has a corresponding assertion in `packages/orchestration/test/decisions.test.ts`.
- Commits: two, Conventional Commits with `AR0284` scope, both signed off — matches worker's final message.

PASS
