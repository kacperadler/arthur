# AR0302 - The inbox's backoff tests still measure 5 s and 10 s windows in real time

```json
{
  "id": "AR0302",
  "title": "The inbox's backoff tests still measure 5 s and 10 s windows in real time",
  "date": "2026-10-22"
}
```

## Description

"a turn that keeps ending without a reply…" asserts real-time gaps between deliveries with upper bounds (`quick < 4000`, `five < 9000`, `ten < 19_000`), "a reply ends the wait…" asserts `quick < 4000`, and "a new owner message ends the wait…" sleeps 2 s and asserts `< 5000`. A runner stalled for seconds overshoots these the way the 30 s tests did (AR0293); the first alone costs about 20 s of a run (19632 ms in `node --test packages/orchestration/test/inbox.test.ts`).

## Goal

The inbox's backoff tests (5 s and 10 s windows, the reply and owner-message waits) run on the test's clock like AR0293's, so a stalled runner cannot fail them and the file runs about 20 s faster.

- Kind: security

Evidence:
- `packages/orchestration/test/inbox.test.ts:418` (and `:452`, `:475`)
- Found by: 2026-10-22-ar0293-de392dd4 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: drive them with the fake agent's `clock` as the 30 s tests now are (`agentClock`, `box.ticked()`): move the clock to 1 ms before each wait and see no delivery, then to the wait and see one. The backoff (`pause` in `inbox-extension.ts`) stays as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- drive them with the fake agent's `clock` as the 30 s tests now are (`agentClock`, `box.ticked()`): move the clock to 1 ms before each wait and see no delivery, then to the wait and see one. The backoff (`pause` in `inbox-extension.ts`) stays as it is.

## Decisions

- 2026-10-22: Source: F1 of AR0293
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
