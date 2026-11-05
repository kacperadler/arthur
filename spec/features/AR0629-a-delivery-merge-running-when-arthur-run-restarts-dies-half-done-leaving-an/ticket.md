# AR0629 - A delivery merge running when arthur run restarts dies half done, leaving an unpushed merge commit on main

```json
{
  "id": "AR0629",
  "title": "A delivery merge running when arthur run restarts dies half done, leaving an unpushed merge commit on main",
  "date": "2026-11-05"
}
```

## Description

The `arthur merge --auto` that delivery starts after a PASS and green CI runs as a child of `arthur run` (or of the coordinator's session). When either restarts while that merge runs its tests, the merge process dies: main keeps a local `Merge ARxxxx` commit that was never pushed, `.arthur/delivery/arthur/merge.lock` names a dead pid, the ticket is not marked merged, and nothing tells the coordinator. A merge survives a restart and finishes, or is rolled back and run again, without the coordinator noticing it by hand.

## Goal

Evidence, the night of 2026-11-04 to 2026-11-05: the merges of AR0621, AR0623, AR0608, AR0624, AR0625 and AR0391 each died this way at a scheduled restart or compaction (seven times in all). Each time the coordinator found the dead lock pid, reset main to the merge's first parent while keeping `spec/build.json`, and ran `arthur merge --auto <job>` again in its own `systemd-run --user` unit, which survived the next restart. No work was lost, but every merge in flight at a restart needed a hand fix.

- Kind: fix

## Done means

- A merge started by delivery runs detached from `arthur run` and the coordinator's session (its own process group or service unit), so stopping either does not end it; a test stops the parent mid-merge and sees the merge finish and push.
- On start, `arthur run` finds a merge lock whose pid is gone with an unpushed merge commit on main: it rolls main back to the merge's first parent, keeping the board, removes the lock, and runs that merge again; a test proves it, and one more proves a live lock is left alone.
- The project's checks pass.

## Scope

In:
- `packages/delivery/src/`: how the merge is started, and the dead-lock recovery on start.
- `packages/delivery/test/`: the tests above.

Out:
- Merges the owner runs by hand from a shell: they already end with the shell.

## Decisions
