# AR0132 - The context extension is proved against the fake agent only, not against real omp

```json
{
  "id": "AR0132",
  "title": "The context extension is proved against the fake agent only, not against real omp",
  "date": "2026-10-18"
}
```

## Description

the fake agent fires `before_agent_start` and records the returned system prompt; whether omp 18.3.0 fires it for a turn the inbox starts with `attribution: "agent"` (an `[Arthur]`-only turn) and keeps the override for that turn was not run against real omp. The predecessor's `hook/context.ts` used the same return shape in production [INFERENCE]. With `--append-system-prompt` gone, a turn that does not fire it would run without the coordinator's role.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: security

Evidence:
- `packages/orchestration/src/context-extension.ts` (`before_agent_start` returning `{ systemPrompt }`)
- Found by: 2026-10-18-ar0120-coordinator-conte-623670be (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: one run against real omp, as AR0113 did for the inbox: an owner turn and an `[Arthur]`-only turn, each checked for the role and the `## Time` section in the request (`omp` session export shows the system prompt).
- `npm test` and `npm run check` pass.

## Scope

In:
- one run against real omp, as AR0113 did for the inbox: an owner turn and an `[Arthur]`-only turn, each checked for the role and the `## Time` section in the request (`omp` session export shows the system prompt).

## Decisions

- 2026-10-18: Source: F1 of AR0120
- 2026-10-18: Dropped: review 1 proved the per-turn hook on real omp (a turn holding only Arthur's own message got the role).
