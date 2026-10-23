# AR0296 - An orchestration test can leave its tmux server and fake agent running after `npm test`

```json
{
  "id": "AR0296",
  "title": "An orchestration test can leave its tmux server and fake agent running after `npm test`",
  "date": "2026-10-22"
}
```

## Description

after a full `npm test` that passed (1018 of 1018), `ps -o pid,ppid,etime,args` still showed `tmux -S /tmp/arthur-test-SCawCc/folder-OLpOiE/tmux.sock new-session -d -P -F #{pane_pid} -s coord -c <worktree> …`, its parent pid 1's user systemd, with `packages/core/src/fake-agent.ts` running in its pane. It had started about 5 minutes before, during that run. It went away with `tmux -S <socket> kill-server`. Seen once, on a machine that was running other suites at the same time; which test started it was not found.

## Goal

Every orchestration test stops the tmux server and fake agent it started, also when it fails, so `npm test` leaves no process running behind it.

- Kind: fix

Evidence:
- `packages/orchestration/test/` (a test whose tmux session is `coord`: `coordinator.test.ts`, `inbox.test.ts` or `silent.test.ts`)
- Found by: 2026-10-22-ar0271-72a7b9ab (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: find the test that starts a `coord` session on its own socket without a `t.after` that kills its server on every path (a supervisor's `stop()` that times out included), and add one. Out: the supervisor's own code.
- `npm test` and `npm run check` pass.

## Scope

In:
- find the test that starts a `coord` session on its own socket without a `t.after` that kills its server on every path (a supervisor's `stop()` that times out included), and add one. Out: the supervisor's own code.

## Decisions

- 2026-10-22: Source: F1 of AR0271
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
