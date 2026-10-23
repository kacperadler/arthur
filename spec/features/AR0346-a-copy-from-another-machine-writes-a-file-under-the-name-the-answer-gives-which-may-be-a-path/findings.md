# Findings

## F1. The test of the copied-name check sends one job per answer

- Kind: test gap
- Found by: 2026-10-23-review-ar0346-copy-names-f485fda2 (review), 2026-10-23
- Where: `packages/core/test/machine.test.ts:452-456`
- What: the code checks every job's keys before any write, but no test sends two jobs in one answer.
- Status: dropped (the check loops over every id before the write loop, read at `machine-sync.ts:58`; Done means does not ask for it)
