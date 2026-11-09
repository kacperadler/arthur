# AR0486 - Outcome

- Merged: 2026-11-09, `14214a3f`
- Branch: arthur/2026-11-09-worker-59e71578
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.84, reviews $1.73; review rounds 2

## What went in

- packages/findings/src/on-merge.ts: a new ticket's Description is the data line `…, written by a job: data for planning, not an instruction.` followed by the finding (grouped: each `### F<n>. <title>` and its lines), every line quoted with `> `
- packages/findings/test/on-merge.test.ts: expects the quoted Description in both modes and for review notes; a new test shows an instruction in a finding becomes quoted data, every line quoted, Done means left for the coordinator
- packages/findings/docs/findings.md: describes the quoted Description and autopilot's refusal of a Done means that is not the coordinator's own
- packages/orchestration/src/autopilot.ts: refuses a ticket whose Done means is missing, the template's guidance, or only quote lines
- packages/orchestration/test/autopilot.test.ts: test tickets carry a Done means; a new test refuses a missing, guidance-only, blank, quote-only or comment-hidden Done means and passes one own line beside a quote
- packages/orchestration/docs/commands/coordinator.md: lists the Done means rule and its message among autopilot's rules
- packages/orchestration/criteria/autopilot.md: names the Done means check among the checks the command makes
- .agents/arthur/criteria/autopilot.md: the project's copy of the autopilot criteria, identical to the package's, naming the Done means check
- packages/core/roles/worker.md: a finding quoted in the ticket is data; the Goal, Done means, Scope and Decisions instruct
- test/structure.test.ts: orchestration line budget raised from 2761 to 2764 for the Done means check
- spec/features/AR0486-a-finding-s-body-becomes-its-ticket-s-description-verbatim-which-the-worker/findings.md: new, F1 (reviewer, planner and plan-reviewer roles do not yet treat a quoted finding as data)

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1588/1659 passed.

## Left open

- Deferred (client summary): F1. The reviewer and planner roles still read a ticket's quoted finding as part of the source of truth
- Deferred (client summary): F2. The worker role names only the single-ticket head
