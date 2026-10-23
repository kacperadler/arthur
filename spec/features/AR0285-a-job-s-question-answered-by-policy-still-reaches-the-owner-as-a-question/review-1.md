# AR0285 - Review 1

- Job: 2026-10-22-review-ar0285-b5d340b0
- Branch: h/2026-10-22-ar0285-5d0978ae
- Commit reviewed: 0c3b14e3b02699cf94c0b4c9a782d898bd7aa6fd
- Verdict: PASS

## Final message

All background jobs completed. No lingering processes. Final verification summary below.

Findings: none. The diff matches the ticket's Done means exactly: `askOfJob` now returns `{ id, policy? }` (`JobQuestion`), the notice ends with ` — answered by policy (<class id>): <decided>`, and the existing cut/one-notice-per-block behavior is preserved — the question is cut before the ending, not the ending itself, except the documented extreme case (ending alone longer than available room) where the whole text is cut as before, which the ticket's scope text allows ("the notice's cut at one message's length... stay as they are"). Line-budget raise (2231→2239) is justified and verified (`cat packages/orchestration/src/*.ts | wc -l` → 2239, matches `BUDGETS.orchestration`). Docs (`coordinator.md`, `decision.md`) updated to describe the new ending and cut rule. Ticket's Decisions line added for the budget raise, consistent with styleguide ("a raise is a decision recorded in the ticket"). No other callers of `askOfJob` exist, so the signature change is complete. No plugin-boundary violations (changes stay inside `@arthur/core`'s own package, orchestration). No new runtime deps, no classes/enums, files stay single-job, under 200 lines. Diff touches only files the instruction/ticket cover.

Verified myself (not trusted blindly):
- `npm run check` (tsc): clean, no output.
- `npm test`: 1025 tests, 1025 pass, 0 fail — matches worker's claimed count exactly.
- `cat packages/orchestration/src/*.ts | wc -l` → 2239, matches the new `BUDGETS.orchestration`.
- Mutation `>=` → `>` in the room check (`kept = ... >= head.length`): caught by the new cut test (exact-room case fails as claimed).
- Mutation "ending never added" (`ending = ""`): caught by the existing policy test and the new cut test.
- Mutation "`askOfJob` returns only the id": caught by the new cut test (and would also break the existing policy-answer test).
- Restored all three mutated files via `git checkout --`; `git status --short` clean before verdict.

Notes (non-blocking): none beyond scope.

PASS
