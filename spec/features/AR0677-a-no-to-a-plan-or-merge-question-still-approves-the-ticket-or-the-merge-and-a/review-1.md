# AR0677 - Review 1

- Job: 2026-11-10-review-53c4d6ad
- Branch: arthur/2026-11-10-worker-1fb651b4
- Commit reviewed: 741c92bb1063b0e782df96ce62997938cf5b0051
- Verdict: PASS

## Final message

**Findings:** none that block the merge. The branch meets all three Done means:

- **The gate checks what was picked.** `packages/orchestration/src/decision-use.ts:52-53` reads the later answer's `picked`. A plan or merge decision passes only on option 1. The refusal names the decision, what it picked and the approval text: `<ID> picked option none|<n>, not option 1, its approval "<text>"`. Budget decisions are left unchanged.
- **Plan and plain merge answers need the id.** In `packages/orchestration/src/decision-writes.ts:38-42`, `impact()` now covers `plan`, plain merge and merge by job, so recording either answer needs an owner message naming the id. `decisions.test.ts` records a bare "yes" and checks it is refused for plan, plain merge and merge by job.
- **The rule is in the docs.** `decision.md`, `coordinator.md` and `plan-ended.md` say plan and merge questions are asked with the approval as option 1 and answered `--picked 1` from a message naming the id. The other pages that described the old flow (delivery `merge.md` and `take-main.md`, core `ticket.md`, projects `init.md` and `onboarding-ended.md`, `docs/plugin-api.md`) say the same.

`decision-use.test.ts` has the refusal tests: no pick and another option, for plan, plain merge, `--unreviewed` and take-main. It also covers a later "no" overriding a "yes", a question from before AR0677 that has no options, and a budget decision needing no pick.

Some edits fall outside the Scope's In: the extra doc pages, the four evals, `scenarios.test.ts`, `plans.test.ts`, and the new refusal for `ask --kind plan|merge` with no `--option`. The final message explains each one, and none goes against the ticket's Decisions or its Out. `findings.md` already records the plan check at spawn (F1) and the eval gap (F2).

## Notes
- (risk) packages/orchestration/src/decision-use.ts:53: the approval is option 1 by convention only. A coordinator that asks `--option 'Not yet' --option 'Merge it'` can record a "no" as `--picked 1` and it passes. The notice sent to the owner (`decision-writes.ts:66`) does not show the option picked, so he cannot see that this happened.
- (minor) packages/orchestration/src/plans.ts:90: the refusal still says `ask him: arthur decision ask --kind plan --ticket <id>`, with no `--option`, and `plan.md:36` quotes it. That command is now refused; it already lacked `--question` before this branch.
- (minor) packages/orchestration/src/decision-use.ts:54: the merge-flag hint `arthur decision ask --kind merge --what <flag>` also lacks `--option`. The no-id hint two lines up was updated; this one was not.

## Checks (on 741c92bb, detached checkout, tree clean)
- `npm run check`: tsc exited cleanly with no errors.
- `npm test`: tests 1717, pass 1653, fail 0, skipped 64. This matches the worker's claim.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived, 27 not run (`--max 25`).
- `npm run mutate -- --max 60`: 52 mutants, 52 caught, 0 survived. These include the conditions that matter here: the `picked !== 1` check, the `approves` guard, the `plan` branch of `impact()` and the ask refusal.
- Line counts: `decision-use.ts` has 65 lines and `decision-writes.ts` has 76, both green. The structure test passes inside `npm test`.
- Not run: the worker's goal check against the real CLI. `npx arthur decision --help` does not work in this checkout because there is no `arthur.config.ts`. I read the doc pages directly instead.

PASS