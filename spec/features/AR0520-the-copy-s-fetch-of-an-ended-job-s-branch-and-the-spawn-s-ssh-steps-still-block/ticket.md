# AR0520 - The copy's fetch of an ended job's branch, and the spawn's SSH steps, still block `arthur run` with no time limit

```json
{
  "id": "AR0520",
  "title": "The copy's fetch of an ended job's branch, and the spawn's SSH steps, still block `arthur run` with no time limit",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0509 (spec/features/AR0509-the-sweep-s-copy-from-another-machine-has-no-size-or-time-bound-so-one-machine/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-61d50fad (worker), 2026-10-27
- Where: `packages/core/src/machine-sync.ts:66` (`gitOver(... "fetch" ...)` in `syncMachine`, run by the sweep), `packages/core/src/job-machine.ts:143-149` (`gitOver`: `spawnSync` of git over ssh, no `timeout`), `:114-122` (`ssh`: `spawnSync`, no `timeout`, default `maxBuffer` of 1 MiB), used by `reach`, `addThere`, `removeThere` and `launchThere` (`machine-sync.ts:103`) and by prune
- What: the copy itself is now bounded (AR0509), but once it finds a run ended there it fetches the branch with a synchronous git over ssh, bounded only by `ConnectTimeout=10`; a machine whose network drops mid-fetch, or whose `git upload-pack` never ends, freezes `arthur run`'s event loop (Telegram, `/stopall`, every plugin) until the call ends. A spawn or prune on such a machine does the same through the sync `ssh()`. [INFERENCE: from the code; not run against a hanging machine.]
- Suggestion: run these steps asynchronously with a time limit (as `execute` does for `sshAsync`), a timeout counted as the machine unreachable; the fetch first, as the sweep runs it every 30 s. Out: the copy, done here.

## Goal

The fetch of an ended job's branch from another machine and the spawn's SSH steps must not block `arthur run` with no time limit (Description: `machine-sync.ts:66`, `job-machine.ts:114-122`, `:143-149`).

- Kind: security

## Done means

- Every `ssh` and git-over-ssh call in `job-machine.ts` has a time limit and a bounded output; one that passes it fails with a message naming the machine and the step, and the sweep goes on.
- A test with a machine whose ssh never answers shows the sweep and the spawn step end within the limit; it fails without the limit.
- The project's checks pass.

## Scope

In:
- `packages/core/src/job-machine.ts`, `packages/core/src/machine-sync.ts` and their tests.

Out:
- The bound on the copy itself (AR0509, done) and its size per answer (AR0521).

## Decisions

- 2026-10-27: Source: F1 of AR0509
