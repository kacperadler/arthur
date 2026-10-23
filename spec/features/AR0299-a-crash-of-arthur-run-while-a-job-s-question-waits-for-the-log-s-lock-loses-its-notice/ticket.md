# AR0299 - A crash of `arthur run` while a job's question waits for the log's lock loses its notice

```json
{
  "id": "AR0299",
  "title": "A crash of `arthur run` while a job's question waits for the log's lock loses its notice",
  "date": "2026-10-22"
}
```

## Description

the handler creates its mark `<home>/orchestration/asked/<event number>-<time>` before it asks in the decision log, and sends the notice after. Since AR0283, while another process holds the log's lock, the notice waits for the lock (up to 60 s) with the mark already made: a crash or restart of `arthur run` in that wait leaves the mark, so the replay after the restart sends no notice and the owner never hears the question. Before, the gap between the mark and the notice was one synchronous write. [INFERENCE] from the lines; not reproduced.

## Goal

A job's question reaches the owner even when `arthur run` crashes or restarts while the question waits for the decision log's lock: the replay after the restart sends the notice that was never sent.

- Kind: security

Evidence:
- `packages/orchestration/src/blocked-notice.ts` (the `asked/` mark, then the notice after `askOfJob`)
- Found by: 2026-10-22-ar0283-2e1ee31c (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: keep a second mark (`asked/<n>-<time>.sent`) written after the notice, and let a replay that finds the first mark without the second look up the job's open question in the log (asking again only when there is none) and send the notice; the one-notice-per-block rule stays.
- `npm test` and `npm run check` pass.

## Scope

In:
- keep a second mark (`asked/<n>-<time>.sent`) written after the notice, and let a replay that finds the first mark without the second look up the job's open question in the log (asking again only when there is none) and send the notice; the one-notice-per-block rule stays.

## Decisions

- 2026-10-22: Source: F1 of AR0283
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-23: Coordinator (free hand): line budget raise accepted, orchestration 2285 to 2309, for the block lock and `.sent` marks in `blocked-notice.ts`, the recovery at `arthur run`'s start and the reuse of an open question in `decision-hooks.ts`.
