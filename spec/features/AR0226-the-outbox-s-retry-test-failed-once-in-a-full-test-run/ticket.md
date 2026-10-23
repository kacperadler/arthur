# AR0226 - The outbox's retry test failed once in a full test run

```json
{
  "id": "AR0226",
  "title": "The outbox's retry test failed once in a full test run",
  "date": "2026-10-20"
}
```

## Description

"one retry per send, after 2 s; ..." (from AR0212, untouched here) failed once in the reviewer's full `npm test` of this branch and passed 3 of 3 alone; the failure's message was not kept. Six concurrent runs of it alone here passed 6 of 6, so the cause is not known. One candidate [INFERENCE]: its `retried.at - failed.at >= 2000` compares two `Date.now()` stamps around a 2 s `setTimeout`, which Node's monotonic timer can end a millisecond short of on the wall clock.

## Goal

The outbox's retry test (`packages/telegram/test/telegram.test.ts:262`) never fails by chance in a full run, so a red `npm test` always means a real break. It failed once in a reviewer's full run and passed alone; one candidate [INFERENCE] is comparing two `Date.now()` stamps around a 2 s `setTimeout` (F2 of AR0224).

- Kind: security

Evidence:
- `packages/telegram/test/telegram.test.ts:262`
- Found by: review of 2026-10-20-ar0224-roadmap-50-phone-f10cd1df (review), 2026-10-20

## Done means

- The fix, with a test that proves it: rerun the full suite until it fails to keep the message, then fix the wait it shows; for the candidate, assert at least 1990 ms.
- `npm test` and `npm run check` pass.

## Scope

In:
- rerun the full suite until it fails to keep the message, then fix the wait it shows; for the candidate, assert at least 1990 ms.

## Decisions

- 2026-10-20: Source: F2 of AR0224
- 2026-10-20: Approved by the coordinator under the owner's free hand in Arthur.
- 2026-10-20: Also F1 of AR0225: "Telegram back while nothing new is sent" failed once under load; check it the same way.
