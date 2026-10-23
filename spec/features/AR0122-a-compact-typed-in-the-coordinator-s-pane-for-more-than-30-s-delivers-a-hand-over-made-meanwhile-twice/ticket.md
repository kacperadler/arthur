# AR0122 - A `/compact` typed in the coordinator's pane for more than 30 s delivers a hand-over made meanwhile twice

```json
{
  "id": "AR0122",
  "title": "A `/compact` typed in the coordinator's pane for more than 30 s delivers a hand-over made meanwhile twice",
  "date": "2026-10-18"
}
```

## Description

measured against omp 18.3.0 with a fake OpenAI-compatible provider: during a manual `/compact` `ctx.isIdle()` stays true, the inbox hands a queued message over, and omp holds that prompt until the compaction ends (17 s there). Past 30 s the watchdog counts the hand-over as lost and hands it again; both prompts then run, the agent sees the message twice, and the second turn's reply is not sent (its `handed` is empty). omp's own compaction before a prompt and after a turn is busy (`isIdle()` false) and is not affected.

## Goal

A `/compact` the owner types in the coordinator's pane never makes the coordinator answer one message twice.

- Kind: security

Evidence:
- `packages/orchestration/src/inbox-extension.ts` (`tick`, `QUIET_MS`)
- Found by: 2026-10-18-ar0111-handover-watchdog-c415e11b (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: have the watchdog, and the hand-over in `tick`, wait while a compaction runs, from `session_before_compact` to `session_compact`, with a cap, since a failed manual compaction emits no end event to extensions (read in the bundle, not run).
- `npm test` and `npm run check` pass.

## Scope

In:
- have the watchdog, and the hand-over in `tick`, wait while a compaction runs, from `session_before_compact` to `session_compact`, with a cap, since a failed manual compaction emits no end event to extensions (read in the bundle, not run).

## Decisions

- 2026-10-18: Source: F1 of AR0111
- 2026-10-18: The owner approved it.
- 2026-10-18: Dropped by the coordinator (owner delegated Arthur calls): the only fix found (listening to `session_before_compact`) turns off omp's background compaction for the coordinator, so every compaction would make the owner wait; that costs more than the rare double reply after a hand-typed `/compact` over 30 s, which stays documented. Branch h/2026-10-18-ar0122-compact-double-de-60bebe84 not merged. Revisit if omp exposes a compaction state to extensions.
