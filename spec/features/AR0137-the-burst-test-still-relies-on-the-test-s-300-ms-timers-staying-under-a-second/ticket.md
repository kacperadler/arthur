# AR0137 - The burst test still relies on the test's 300 ms timers staying under a second

```json
{
  "id": "AR0137",
  "title": "The burst test still relies on the test's 300 ms timers staying under a second",
  "date": "2026-10-18"
}
```

## Description

the test sends four messages 300 ms apart and expects one turn; the inbox extension hands the queue over once it has not grown for `SETTLE_MS` (1 s) by `Date.now()` in the agent's process (`packages/orchestration/src/inbox-extension.ts:143`). A test process stalled for 700 ms between two messages would see them split into two turns. It passed every one of the 20 orchestration runs under load and the 6 full loaded runs; the gap cannot be held open from the test, since the extension reads the real clock.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `packages/orchestration/test/inbox.test.ts:173` ("several messages while idle, each within a second of the last, are one turn, in order")
- Found by: 2026-10-18-ar0136-flaky-test-6f928022 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: give the extension's clock a test seam (the fake agent could pass one in), so the test moves time instead of sleeping; that touches production code, out of AR0136's scope.
- `npm test` and `npm run check` pass.

## Scope

In:
- give the extension's clock a test seam (the fake agent could pass one in), so the test moves time instead of sleeping; that touches production code, out of AR0136's scope.

## Decisions

- 2026-10-18: Source: F6 of AR0136
