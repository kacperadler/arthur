# AR0677 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A worker's plan check still reads the decided line, not the option the owner picked

- Kind: security
- Found by: 2026-11-10-worker-1fb651b4 (worker), 2026-11-10
- Where: `packages/orchestration/src/plans.ts:84-88`
- What: since AR0677 `decision.owner` passes a plan decision only when its later answer picked option 1, its approval. The spawn check of a `- Plan: yes` ticket's worker (`unplanned`) still counts an approval when the answer's `--decided` reads `Plan approved by the owner: plan.md at <commit>`, whatever it picked: an answer recorded with that `--decided` and `--picked 2` (or no `--picked`) still lets the worker start, though `arthur ticket status <id> planned --decision <id>` refuses it.
- Suggestion: in `proved`, require `answer.picked === 1` beside the decided line, with a row in `plans.test.ts` for no pick and for `--picked 2`; out: the Decisions line's format.
- Status: open

## F2. The merge evals name a decision id the turn's context never shows

- Kind: test
- Found by: 2026-11-10-worker-1fb651b4 (worker), 2026-11-10
- Where: `packages/delivery/evals/merge/scenario.json:3`, `packages/delivery/evals/check-failed/scenario.json:3`, `packages/session/evals/after-restart-plan/scenario.json:6`, `packages/session/evals/unblocked-after-restart/scenario.json:6`
- What: since AR0677 a plain merge's answer is recorded only from an owner message that names its id, so these four scenarios now play the owner's reply `<id> yes, merge <ticket>` to a merge question asked earlier. An eval's context has no open decisions (`context.ts:23-26`, `coordinatorContext` with a checkout), so the coordinator sees the id only in the message, not the question it answers; the round trip itself (the owner's unasked "merge X", the ask, his reply naming the id) is measured by no scenario.
- Suggestion: let a scenario give the open decisions of its fixture's `spec/decisions.jsonl` to the checkout context, and add a scenario where "merge SH0006" alone leads to `arthur decision ask --kind merge ... --option` and a reply naming the id, with `never: ["^arthur merge "]`; out: the scoring rules.
- Status: open
