# AR0111 - A hand-over omp accepts and then fails leaves the inbox waiting until a restart

```json
{
  "id": "AR0111",
  "title": "A hand-over omp accepts and then fails leaves the inbox waiting until a restart",
  "date": "2026-10-17"
}
```

## Description

in omp 18.3.0's interactive mode, `pi.sendUserMessage` returns nothing and catches the session's rejected promise itself ("Extension sendUserMessage failed", read in the bundle, not run). Only a synchronous throw reaches the extension, so only that path is retried and told by a `notice`. An asynchronous failure leaves the turn's messages in `inbox/turn/` with the extension believing a turn runs: nothing more is handed over until the coordinator restarts, when they are delivered again, marked. Nothing is lost, but the owner gets no reply meanwhile.

## Goal

The owner always gets a reply: a hand-over omp accepts and then fails is noticed and retried, not left until a restart.

- Kind: risk

Evidence:
- `packages/orchestration/src/inbox-extension.ts` (`hand`, `tick`)
- Found by: 2026-10-17-ar0084-inbox-ceecda3e (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: a watchdog in `tick`: an idle hand-over that saw no `agent_start` within a limit counts as a failed one. The limit must outlast a compaction omp runs before the prompt, or the message is delivered twice; measure that against real omp first.
- `npm test` and `npm run check` pass.

## Scope

In:
- a watchdog in `tick`: an idle hand-over that saw no `agent_start` within a limit counts as a failed one. The limit must outlast a compaction omp runs before the prompt, or the message is delivered twice; measure that against real omp first.

## Decisions

- 2026-10-17: Source: F1 of AR0084
