# AR0140 - Review 1

- Job: 2026-10-18-review-ar0140-7877895e
- Branch: h/2026-10-18-ar0140-d850a4c7
- Commit reviewed: 53f46ff0ef6277e7952d34619e4466c7b5f578ad
- Verdict: PASS

## Final message

## Findings

None blocking.

## Notes

- `findings.md`'s F1 (budget recorded but not enforced at spawn) is a real gap but explicitly out of entry 29's Done means (roadmap 29 only requires recording and moving the ticket); correctly filed as an open finding rather than silently left unhandled.
- F2 (concurrent `--autopilot` race) honestly marked `[INFERENCE: not reproduced]`; acceptable as a filed risk, not a requirement of this ticket.
- Prose in `roles/coordinator.md` ("but by `--autopilot` as above") is slightly awkward but not misleading.

## Checks run

- `npm ci` — clean.
- `npm run check` (`tsc`) — clean, no errors.
- `npm test` — 486/486 pass (full run, ~218s), including `test/structure.test.ts`'s "the repository keeps every rule" against the real tree with the new budgets (core 4864, orchestration 1135).
- Verified line-budget raises against `git diff --numstat` per file: orchestration net +111 (104 new `autopilot.ts` + 4 + 3 + 0 across `orchestration-options.ts`/`orchestration.ts`/`plans.ts`), core net +14 (−2 `cli.ts` + 2 `host.ts` + 14 `ticket-command.ts`) — both match the worker's claimed deltas exactly; no padding.
- Cross-checked the three "needs OK" contracts (delivery.alwaysReview shape, Source: Decisions line form, criteria/autopilot.md path) against `main`'s ticket Decisions line — all three are recorded as accepted there, matching the code.
- Mutation-tested 6 of autopilot's rules by disabling/inverting each in `packages/orchestration/src/autopilot.ts` and rerunning `node --test packages/orchestration/test/autopilot.test.ts`: planning-status check, always-review call, budget-over-cap, SCOPE_FILES off-by-one, folder/pattern (`loose`) check, kind check, source check, budget>0 check — every mutation was caught (test failures), each restored via `cp` from backup; `git status --porcelain` empty afterward confirming no residue.
- Spot-checked CLI wiring (`ticket-command.ts`, `cli.ts`, `host.ts`) against `packages/core/test/cli.test.ts`: exit 2 wrong-usage cases (dropped+autopilot, missing budget value, negative budget, double budget, unknown flag) and exit 1 refusal path all present and asserted.
- Confirmed plugin boundary: `autopilot.ts` imports only `@arthur/core/plugin` types and its own package's `plans.ts`; reaches delivery only via `host.call`, never a direct import.
- Confirmed docs (`coordinator.md` Autopilot section) describe the exact refusal message strings found in `autopilot.ts` — verbatim match, no drift.
- Confirmed `findings.md` boilerplate header (mentioning `h merge`, `H_AUTOPILOT_BUDGET_MAX`) is pre-existing template text reused across dozens of other feature folders, not new leakage introduced by this branch.

PASS
