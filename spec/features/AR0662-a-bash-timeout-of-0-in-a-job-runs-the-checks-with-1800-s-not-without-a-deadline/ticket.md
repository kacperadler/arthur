# AR0662 - A bash timeout of 0 in a job runs the checks with 1800 s, not without a deadline

```json
{
  "id": "AR0662",
  "title": "A bash timeout of 0 in a job runs the checks with 1800 s, not without a deadline",
  "date": "2026-11-07"
}
```

## Description

A job that runs `npm run check`, `npm test` or `npm run mutate` with the bash tool's `timeout` set to `0`, which means no deadline, gets no deadline, as the coordinator and the roles tell it to do for a long mutate run.

## Goal

`packages/delivery/src/checks-extension.ts:28` returns the call's input with `timeout: Math.max(<given or 0>, 1800)`. A given `0` (no deadline) becomes 1800, so a mutate run longer than 30 minutes is always killed with no result.

Evidence: on 2026-11-07 the AR0644 worker (2026-11-06-worker-926f0a0f) ran `npm run mutate -- --max 25` four times on its tip 5be8cc1c with `timeout: 0`, as it was told; each was cut off at 1800 s (`error: interrupted`, no count line; `<home>/delivery/2026-11-06-worker-926f0a0f/checks`: `mutate fail 5be8cc1c… clean` three times), and the job ended on its 120-minute limit. PR #10 waited a day for it.

- Kind: fix

## Done means

- A checks call with `timeout: 0` keeps `0`; a call with no timeout, or one below 1800, still gets 1800; one above 1800 keeps its own.
- A test in `packages/delivery/test/checks.test.ts` for each of those three cases; the `0` case fails on today's code.
- `packages/delivery/docs/commands/review-needed.md:35` says that `0` stays no deadline.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/delivery/src/checks-extension.ts` (line 28)
- `packages/delivery/test/checks.test.ts`
- `packages/delivery/docs/commands/review-needed.md` (line 35)

Out:
- How long mutate runs (AR0658 makes it end by itself before 1800 s).
- The job's own time limit.

## Decisions
- 2026-11-07: AR0662 approved: a checks call with bash timeout 0 keeps no deadline; started tomorrow with the other approved tickets; the owner: "AR-D554 - 1" (AR-D554)
- 2026-11-09: Merge it, in the order of the night summary (AR0659 before AR0499); the owner: "Merge all 11 in order above." (AR-D567)

