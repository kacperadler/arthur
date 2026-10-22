# AR0296 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The test kit's exit removes the sockets of tmux servers a test left, so nothing can reach them

- Kind: risk
- Found by: 2026-10-22-ar0296-20b416b1 (worker), 2026-10-22
- Where: `packages/core/src/testing.ts:33`
- What: at a test process's exit the kit removes its temporary root (`rmSync(root, { recursive: true, force: true })`), which holds every test's tmux socket (`TMUX_TMPDIR` and the `tmux.sock` the orchestration tests make under `temporaryFolder()`). A tmux server a test left running keeps running without its socket: `tmux -S <socket> kill-server` then fails with `error connecting to <socket> (No such file or directory)`, and only `kill` by pid ends it. Reproduced by hand: `tmux -S $d/s new-session -d -s probe sleep 300; rm -rf $d; tmux -S $d/s kill-server` exits 1 and the server stays in `ps`.
- Suggestion: before the removal, the exit hook runs `tmux -S <socket> kill-server` for each socket under its root (and `tmux kill-server` under its `TMUX_TMPDIR`), so a server no test ended goes with its process. Out: the tests' own ends, which AR0296 made stop the server on every path.
- Status: open
