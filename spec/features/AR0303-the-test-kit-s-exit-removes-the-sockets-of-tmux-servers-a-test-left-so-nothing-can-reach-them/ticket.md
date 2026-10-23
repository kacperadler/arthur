# AR0303 - The test kit's exit removes the sockets of tmux servers a test left, so nothing can reach them

```json
{
  "id": "AR0303",
  "title": "The test kit's exit removes the sockets of tmux servers a test left, so nothing can reach them",
  "date": "2026-10-22"
}
```

## Description

at a test process's exit the kit removes its temporary root (`rmSync(root, { recursive: true, force: true })`), which holds every test's tmux socket (`TMUX_TMPDIR` and the `tmux.sock` the orchestration tests make under `temporaryFolder()`). A tmux server a test left running keeps running without its socket: `tmux -S <socket> kill-server` then fails with `error connecting to <socket> (No such file or directory)`, and only `kill` by pid ends it. Reproduced by hand: `tmux -S $d/s new-session -d -s probe sleep 300; rm -rf $d; tmux -S $d/s kill-server` exits 1 and the server stays in `ps`.

## Goal

A tmux server a test leaves behind can still be ended: the test kit kills the servers on its sockets before it removes its temporary root, so no orphaned server outlives `npm test`.

- Kind: risk

Evidence:
- `packages/core/src/testing.ts:33`
- Found by: 2026-10-22-ar0296-20b416b1 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: before the removal, the exit hook runs `tmux -S <socket> kill-server` for each socket under its root (and `tmux kill-server` under its `TMUX_TMPDIR`), so a server no test ended goes with its process. Out: the tests' own ends, which AR0296 made stop the server on every path.
- `npm test` and `npm run check` pass.

## Scope

In:
- before the removal, the exit hook runs `tmux -S <socket> kill-server` for each socket under its root (and `tmux kill-server` under its `TMUX_TMPDIR`), so a server no test ended goes with its process. Out: the tests' own ends, which AR0296 made stop the server on every path.

## Decisions

- 2026-10-22: Source: F1 of AR0296
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
