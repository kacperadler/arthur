# AR0120 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. The context extension is proved against the fake agent only, not against real omp

- Kind: risk
- Found by: 2026-10-18-ar0120-coordinator-conte-623670be (worker), 2026-10-18
- Where: `packages/orchestration/src/context-extension.ts` (`before_agent_start` returning `{ systemPrompt }`)
- What: the fake agent fires `before_agent_start` and records the returned system prompt; whether omp 18.3.0 fires it for a turn the inbox starts with `attribution: "agent"` (an `[Arthur]`-only turn) and keeps the override for that turn was not run against real omp. The predecessor's `hook/context.ts` used the same return shape in production [INFERENCE]. With `--append-system-prompt` gone, a turn that does not fire it would run without the coordinator's role.
- Suggestion: one run against real omp, as AR0113 did for the inbox: an owner turn and an `[Arthur]`-only turn, each checked for the role and the `## Time` section in the request (`omp` session export shows the system prompt).
- Status: dropped (review 1 proved it on real omp)

## F2. README and arthur.mmd still list entry 25 as not built

- Kind: cleanup
- Found by: 2026-10-18-ar0120-coordinator-conte-623670be (worker), 2026-10-18
- Where: `README.md` (Status, What is next, the orchestration row), `arthur.mmd` (orchestration "3 of 8 entries")
- What: both count an entry as built once its ticket is merged, so they were left as they are on this branch.
- Suggestion: after the merge, orchestration is 4 of 8 entries (23 to 26 built), and the coordinator's line in "What works today" gains its context on every turn.
- Status: ticket AR0121 (it updates the README with entry 27)
