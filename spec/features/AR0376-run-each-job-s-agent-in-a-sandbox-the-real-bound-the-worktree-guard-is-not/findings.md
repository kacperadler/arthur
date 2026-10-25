# AR0376 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Inside a sandboxed job, the orchestration tests that start a tmux server fail

- Kind: test
- Found by: 2026-10-24-ar0376-job-sandbox-retry-6b3fc3f2 (worker), 2026-10-25
- Where: `packages/orchestration/test/coordinator.test.ts:29`, `inbox.test.ts:53`, `silent.test.ts:196`; the filter in `packages/core/src/job-sandbox.ts`
- What: the sandbox refuses every new Unix socket (so a job reaches neither the user manager's bus nor a tmux server outside it), and so tmux cannot make its own server's socket either. Run under the sandbox, `node --import @arthur/core/testing --test packages/orchestration/test/coordinator.test.ts` prints `orchestration: coordinator start failed: tmux new-session: error connecting to /tmp/arthur-test-…/tmux.sock (Permission denied)` again and again. A worker on Arthur itself that runs `npm test` will see these tests fail; `arthur merge` runs the checks outside the sandbox, where they pass.
- Suggestion: those tests skip, naming why, where a Unix socket cannot be made (one `socket()` probe at load, as `doctor.test.ts` skips for root); the sandbox stays as it is. Out: allowing Unix sockets in the sandbox, which would give the job the user manager's bus again.
- Status: open
