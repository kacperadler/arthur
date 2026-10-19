# AR0135 - The inbox drops a new message whose event number an old one had, after the event log is cut by hand

```json
{
  "id": "AR0135",
  "title": "The inbox drops a new message whose event number an old one had, after the event log is cut by hand",
  "date": "2026-10-18"
}
```

## Description

`queue` skips an event when `inbox/queued|turn|answered/<event number>` exists (the test "one event queued twice, and again after its file moved to turn/ and answered/, leaves one file" pins it), and files in `answered/` stay 7 days. A log cut or deleted by hand starts the numbers again (core test "numbers start again in the cut log", `packages/core/test/events.test.ts`), so within those 7 days a new owner message, job end or schedule action whose number an answered one had is never queued: the coordinator never sees it. The blocked notice of this ticket had the same hole and keys its mark by number and event time instead (`packages/orchestration/src/blocked-notice.ts`, commit 6d592bc).

## Goal

A new owner message is never dropped as a duplicate after the event log is cut by hand: the inbox tells a reused event number from the event it already took.

- Kind: risk

Evidence:
- `packages/orchestration/src/inbox.ts:49` (`queue`)
- Found by: 2026-10-18-ar0121-job-state-123cb6fe (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: name an inbox file `<event number>-<event time in ms>` (or skip only when the queued file's own content and time match), keeping the order by number; the extension's reading of the names and the restart's matching of replies (`answers`) to files follow. Out: the log's numbering itself.
- `npm test` and `npm run check` pass.

## Scope

In:
- name an inbox file `<event number>-<event time in ms>` (or skip only when the queued file's own content and time match), keeping the order by number; the extension's reading of the names and the restart's matching of replies (`answers`) to files follow. Out: the log's numbering itself.

## Decisions

- 2026-10-18: Source: F1 of AR0121
- 2026-10-19: Approved under the owner's word: built in the orchestration findings batch (host AR0154).
