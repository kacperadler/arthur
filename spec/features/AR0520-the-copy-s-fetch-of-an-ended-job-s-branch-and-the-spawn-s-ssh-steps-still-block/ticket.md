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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F1 of AR0509
