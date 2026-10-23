# AR0305 - A lock left by a crashed process whose pid the taker now has counts as held by a live process

```json
{
  "id": "AR0305",
  "title": "A lock left by a crashed process whose pid the taker now has counts as held by a live process",
  "date": "2026-10-23"
}
```

## Description

a lock file names its holder's pid and boot; `takeLock` treats a holder whose pid is alive as live, also when that pid is the taker's own, which a new process in the same boot can have when the crashed holder had it (a container restarted with `docker restart` keeps the boot id and starts `arthur run` again as pid 1, [INFERENCE] from Docker's PID namespaces, not run). Then `run.pid` refuses the start (`is already run by pid <its own pid>`), and the `asked/<n>-<time>.lock` a crash left (AR0299) is never taken over. Seen with `node -e` writing `<own pid> <boot id>` into a file and calling `takeLock` on it: it answered `{"heldBy":<own pid>}`.

## Goal

A lock whose recorded holder is the taker's own pid is taken over, so `arthur run` restarted as the same pid in the same boot (a `docker restart`) starts and recovers the notices a crash left.

- Kind: security

Evidence:
- `packages/core/src/lock.ts` (`takeLock`, `alive`)
- Found by: 2026-10-22-ar0299-69921f31 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: tell a lock this process took from one an earlier process of the same pid left, for example a per-process random token written beside the pid and kept in memory, so a file naming this pid without this process's token counts as a dead holder's; this process's own live locks stay held.
- `npm test` and `npm run check` pass.

## Scope

In:
- tell a lock this process took from one an earlier process of the same pid left, for example a per-process random token written beside the pid and kept in memory, so a file naming this pid without this process's token counts as a dead holder's; this process's own live locks stay held.

## Decisions

- 2026-10-23: Source: F1 of AR0299
- 2026-10-23: Coordinator (free hand, finding ticket) approved.
- 2026-10-23: Coordinator (free hand): line budget raise accepted, core 5755 to 5772, for the set of locks this process holds in `lock.ts`.
- 2026-10-23: Coordinator (free hand): the in-memory set of held locks (device and inode) instead of the ticket's example token is accepted: the file format stays, and an old process still running cannot take over a new lock.
