# AR0035 - An event a command emits reaches the log but not the daemon's subscribers

```json
{
  "id": "AR0035",
  "title": "An event a command emits reaches the log but not the daemon's subscribers",
  "date": "2026-10-16",
  "after": [
    "AR0011"
  ]
}
```

## Description

`emit` delivers to the subscribers of its own process only. An event a command emits (`arthur ticket` writing `ticket-moved`, entry 17; `arthur spawn` writing `job-started`, entry 9) is appended to `.arthur/events.jsonl` with its number, but the plugins subscribed inside `arthur run` (telegram, delivery, orchestration) never get it. No roadmap entry says who carries an event from a command to the daemon; entry 18's "`job-started` of a worker sets in-progress" and entry 47's `notice` sending both depend on it whenever the emitter is a command. [INFERENCE] from the entries' text: none of them is built yet.

## Goal

An event a short-lived command emits (`arthur ...`) reaches the running daemon's subscribers, not only the log, so plugins react to it as to any other event.

- Kind: improvement

Evidence:
- `packages/core/src/events.ts:32`
- Found by: 2026-10-16-ar0008-event-stream-b32e80cb (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: decide in entry 8 (`arthur run`) that the daemon follows the log from the last number it delivered (`readEvents(fromSeq)` on a short timer or `fs.watch`) and delivers events whose line was written by another process; the emitting process keeps delivering its own at once. Out: a socket or any port.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide in entry 8 (`arthur run`) that the daemon follows the log from the last number it delivered (`readEvents(fromSeq)` on a short timer or `fs.watch`) and delivers events whose line was written by another process; the emitting process keeps delivering its own at once. Out: a socket or any port.

## Decisions

- 2026-10-16: Source: F1 of AR0008
