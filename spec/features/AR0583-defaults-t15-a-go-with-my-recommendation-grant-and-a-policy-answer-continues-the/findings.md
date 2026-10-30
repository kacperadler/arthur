# AR0583 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A decision answered by recommendation can back a class

- Kind: fix
- Found by: 2026-10-30-worker-6d2278ad (worker), 2026-10-30
- Where: `packages/orchestration/src/decision-class.ts:27`
- What: `arthur decision class propose --backed-by <id>` refuses a backing decision answered by policy, but takes one answered `by recommendation: <grant id>` (the owner's grant, `arthur silent on ... --recommend`) as the owner's own answer. A class built on the coordinator's own recommendations would then answer by policy for good, with evidence that reads as the owner's. [INFERENCE: read in the code, not run] the refusal checks `policyOf` only, so grant with `--until`, ask with `--recommend 1`, then `class propose --backed-by` that id would be accepted.
- Suggestion: refuse a backing answer whose words start `by recommendation:` as the one by policy is refused, naming it. Leave the grant itself as it is.
- Status: fixed in d482c8ea

## F2. decision.owner takes a by-recommendation answer as the owner's

- Kind: security
- Found by: 2026-10-30-worker-6d2278ad (worker), 2026-10-30
- Where: `packages/orchestration/src/decision-use.ts:42`
- What: `refusal` refuses an answer by policy for `arthur merge --unreviewed|--no-ci`, `--budget 0` and `arthur take-main`, but not one by recommendation. The grant never answers a merge with `--what` or a budget question (this ticket, tested in `silent.test.ts`), so those stay the owner's. [INFERENCE: read in the code and `decision.md`, not run] `arthur take-main` asks a kind `merge` question with no `--what`, which a grant without `--tickets` does answer, and `decision.owner` would then let take-main through on the coordinator's recommendation.
- Suggestion: in `refusal`, refuse an answer whose words start `by recommendation:` like one by policy (`<id> was answered by recommendation (<grant id>), not by the owner`), with a row in `decision-use.test.ts`.
- Status: fixed in d482c8ea

## F3. The coordinator's role does not say when to record a grant

- Kind: docs
- Found by: 2026-10-30-worker-6d2278ad (worker), 2026-10-30
- Where: `packages/orchestration/roles/coordinator.md:64`
- What: the role turns silent mode on for delegated work but never names `--recommend` and its bounds, so the coordinator knows to record a grant only from its handoff memory, which the plan (P13) deletes once this ticket merges, or from `arthur silent --help`.
- Suggestion: one clause on line 64: when the owner says to go with your recommendation, add `--recommend` with the bound he names (`--until`, `--usage`, `--tickets`), and ask every decision with `--recommend`. Delete the handoff's grant memory only after that line is in.
- Status: open
