# AR0573 - Defaults T5: the merge writes What went in per file and commits the ticket's folder itself

```json
{
  "id": "AR0573",
  "title": "Defaults T5: the merge writes What went in per file and commits the ticket's folder itself",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T5: P8 (What went in, the commit), P5. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

The worker's final message gets `## What went in`, one `- <path>: <what it does now>` line per file of the branch. `settleTicket` keeps those lines and adds `- <path>: not described` for a changed file left out; with no such section it falls back to the commit subjects. Then it commits the ticket folder, the tickets made, `spec/build.json` and `CHANGELOG.md` as `spec: <id> merged` before `github.push`, with `core.hooksPath=/dev/null` and after the identity check. `styleguide.md:13` becomes: "a raise of an existing package's budget shows in the merge's outcome.md; a new package's first budget is the owner's decision".

- Kind: feat

## Done means

- `merge.test.ts`: the per-file lines, the `not described` fallback, the commit-subject fallback, the `spec:` commit before the push.
- Deleted: `after-merge.md` steps 1 and 4, `merge-outcome.ts:62` "rewrite What went in...", the `nothing committed but the merge` line, the `test/structure.test.ts:8` comment clause, the last sentence of `coordinator.md:49`.
- The delivery evals' merge output updated.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (delivery +25), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/merge-outcome.ts`, `packages/delivery/src/merge-command.ts`, `packages/core/roles/worker.md`, `packages/delivery/roles/coordinator/after-merge.md`, `packages/orchestration/roles/coordinator.md`, `.agents/arthur/criteria/styleguide.md`, `packages/delivery/evals/*/scenario.json`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- Parsing BUDGETS in delivery (the plan's Option 1).

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
