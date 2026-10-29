# AR0522 - Findings

Notes from the reviews of AR0522, settled at the merge.

## F1. A stop waiting on a sweep ignores a second Ctrl-C

- Kind: ux
- Found by: 2026-10-29-review-4dfce440 (reviewer), 2026-10-29
- Where: `packages/core/src/run.ts:90`
- What: [inference from the code] while the stop waits for sweeps, the signal handlers stay registered, so a second Ctrl-C does nothing, and a local sweep that never ends would block the stop; the copy itself has a 20 s limit (AR0509).
- Status: deferred (client summary)

## F2. The no-sweep test notices only a delay over its 10 ms poll

- Kind: test
- Found by: 2026-10-29-review-4dfce440 (reviewer), 2026-10-29
- Where: `packages/core/test/run.test.ts:50-51`
- What: a 2 ms delay before the release passes, a 15 ms one fails.
- Status: dropped (close enough to "as quick as today")
