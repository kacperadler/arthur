# AR0481 - Findings

Notes from the reviews of AR0481, settled at the merge.

## F1. The new stop-during-install test has a 2 s window

- Kind: test
- Found by: 2026-10-29-review-1d5fa9ce (reviewer), 2026-10-29
- Where: `packages/core/test/job-control.test.ts:171`
- What: `stopJob` must land between the install's exit and its `close`; if it misses, the agent starts and the test fails. The AR0464 test at `:129` has the same window. It passed 3 of 3 runs alone.
- Status: deferred (client summary)

## F2. A stray `sleep 300` on the host

- Kind: chore
- Found by: 2026-10-29-review-1d5fa9ce (reviewer), 2026-10-29
- Where: the host, under `systemd --user`
- What: a `sleep 300` of unknown origin ran during the review; this branch's test kills its own forked process.
- Status: dropped (not from this branch; the AR0481 worker reported its own waits gone)
