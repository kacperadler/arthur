# AR0489 - Findings

Notes from the reviews of AR0489, settled at the merge.

## F1. The real-tmux test is skipped inside a job

- Kind: test
- Found by: 2026-10-28-worker-868f32b2 (worker), 2026-10-28-review-f3805ea0 (reviewer), 2026-10-28
- Where: `packages/orchestration/test/coordinator.test.ts` ("a model ending in ; starts the coordinator on a real tmux...")
- What: the job sandbox refuses Unix sockets, so neither the worker nor the reviewer could run it.
- Status: dropped (the coordinator ran it on this server outside a job: 2 pass, 0 skipped)
