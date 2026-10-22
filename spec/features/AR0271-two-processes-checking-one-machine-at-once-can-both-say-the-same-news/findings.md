# AR0271 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. An orchestration test can leave its tmux server and fake agent running after `npm test`

- Kind: bug
- Found by: 2026-10-22-ar0271-72a7b9ab (worker), 2026-10-22
- Where: `packages/orchestration/test/` (a test whose tmux session is `coord`: `coordinator.test.ts`, `inbox.test.ts` or `silent.test.ts`)
- What: after a full `npm test` that passed (1018 of 1018), `ps -o pid,ppid,etime,args` still showed `tmux -S /tmp/arthur-test-SCawCc/folder-OLpOiE/tmux.sock new-session -d -P -F #{pane_pid} -s coord -c <worktree> …`, its parent pid 1's user systemd, with `packages/core/src/fake-agent.ts` running in its pane. It had started about 5 minutes before, during that run. It went away with `tmux -S <socket> kill-server`. Seen once, on a machine that was running other suites at the same time; which test started it was not found.
- Suggestion: find the test that starts a `coord` session on its own socket without a `t.after` that kills its server on every path (a supervisor's `stop()` that times out included), and add one. Out: the supervisor's own code.
- Status: open
