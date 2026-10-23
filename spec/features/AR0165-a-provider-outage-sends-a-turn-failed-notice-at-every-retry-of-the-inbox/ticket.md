# AR0165 - A provider outage sends a `turn failed` notice at every retry of the inbox

```json
{
  "id": "AR0165",
  "title": "A provider outage sends a `turn failed` notice at every retry of the inbox",
  "date": "2026-10-19"
}
```

## Description

entry 38 sends one `turn failed on <host>: <reason>` per coordinator turn that fails before any text. While a provider is down, the inbox hands the same messages over again after 10 s, then twice as long each time up to 5 min, and each of those turns fails, so the channels get about 8 notices in the first 20 minutes and one every 5 minutes after that, all with the same reason [INFERENCE: from the inbox's backoff, not run against a real outage].

## Goal

A provider outage sends one turn-failed notice, not one at every retry of the inbox.

- Kind: feat

Evidence:
- `packages/session/src/turn-extension.ts`, `packages/orchestration/src/inbox-extension.ts:117`
- Found by: 2026-10-18-ar0157-0be32dff (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: tell a reason once until a turn succeeds (or the reason changes), and say when it works again; decide whether that belongs to session or to the inbox's own notice after 3 unanswered turns.
- `npm test` and `npm run check` pass.

## Scope

In:
- tell a reason once until a turn succeeds (or the reason changes), and say when it works again; decide whether that belongs to session or to the inbox's own notice after 3 unanswered turns.

## Decisions

- 2026-10-19: Source: F2 of AR0157
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
