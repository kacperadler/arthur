# AR0574 - Outcome

- Merged: 2026-10-30, `9a45692e`
- Branch: arthur/2026-10-30-worker-44de7e7b
- Reviews: review-1.md PASS
- Cost: worker $4.77, reviews $1.15; review rounds 1

## What went in

- packages/delivery/roles/reviewer.md: fixes the notes as `## Notes` with `- (<kind>) <file:line>: <title>. <what>` lines, kinds security/bug/risk/minor.
- packages/delivery/src/merge-outcome.ts: passes the `## Notes` lines of the branch's last filed PASS review, and its job, to `findings.onMerge` as `review` and `notes`.
- packages/delivery/docs/commands/merge.md: step 4 documents the `review` and `notes` fields of the request.
- packages/delivery/roles/coordinator/after-merge.md: the step that copied review notes into findings.md is gone; two steps remain.
- packages/delivery/test/merge.test.ts: checks which notes reach `findings.onMerge` (last PASS only, `## Notes` only, this branch only, none without a review); the findings request now carries `review` and `notes`.
- packages/delivery/evals/merge/scenario.json: the merge stub files the risk note as SH0016; the scenario scores no `arthur ticket new` and a reply naming SH0016.
- packages/delivery/evals/merge/fixture/spec/features/SH0006-count-the-items-per-order-in-the-sales-report/review-1.md: its notes in the new `## Notes` format.
- packages/delivery/evals/review-pass/scenario.json: the merge output ends with the new after-merge.md.
- packages/session/evals/after-restart-plan/scenario.json: the merge output ends with the new after-merge.md.
- packages/session/evals/unblocked-after-restart/scenario.json: the merge output ends with the new after-merge.md.
- packages/develop/test/scenarios.test.ts: the `delivery/merge` act matches the new scenario; the unused FINDINGS and SH0006 constants are removed.
- packages/findings/src/on-merge.ts: adds a passed review's security/bug/risk notes as open entries (creating findings.md from the template head if missing, never twice for the same review), then settles them in the project's mode.
- packages/findings/docs/findings.md: "At a merge" documents the notes, the entry shape, the no-duplicates rule, and that the merge commits.
- packages/findings/templates/findings.md: says the merge adds a passed review's security, bug and risk notes.
- packages/findings/test/on-merge.test.ts: covers notes becoming entries, settled in ticket and summary modes, numbering, never filed twice, and a refused title.
- test/findings-merge.test.ts: end to end, a real PASS review's bug note becomes an entry and a ticket committed with the merge; the obsolete procedure test is removed.
- test/structure.test.ts: budgets delivery 1774, findings 276.
- spec/features/AR0574-defaults-t6-a-passed-review-s-notes-reach-findings-md-by-themselves/findings.md: F1 (eval baseline out of date) and F2 (notes unfiled without the findings plugin), both open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1315/1383 passed.

## Left open

- Deferred (client summary): F1. The delivery/merge eval's baseline predates its new scenario
- Deferred (client summary): F2. Without the findings plugin, a passed review's notes reach no findings.md
- Deferred (client summary): F3. Without the findings plugin, a worker's own open entries are settled by no one either.
- Deferred (client summary): F4. A note's title ends at its first period and space.
- Deferred (client summary): F5. The merge eval's stubbed findings.md head differs from the template's.
