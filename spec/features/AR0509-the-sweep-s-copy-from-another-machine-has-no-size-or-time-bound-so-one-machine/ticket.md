# AR0509 - The sweep's copy from another machine has no size or time bound, so one machine stalls every job on it, or all of `arthur run`

```json
{
  "id": "AR0509",
  "title": "The sweep's copy from another machine has no size or time bound, so one machine stalls every job on it, or all of `arthur run`",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0405 (spec/features/AR0405-security-review-of-our-own-code-part-4-other-machines-network-and-dependencies/findings.md).

- Kind: security
- Severity: medium
- Found by: 2026-10-27-worker-03ddbe1b (worker), 2026-10-27
- Where: `packages/core/src/job-machine.ts:114-122` (`ssh`: `spawnSync` with neither `maxBuffer` nor `timeout`), `packages/core/src/machine-sync.ts:57` (the copy), `:68` (`synced` moves only after a copy is written), `:37-50` (only exit 255 counts as offline), `packages/core/src/jobs.ts:128` (run in `arthur run`'s sweep, synchronously); `packages/core/src/wrapper.ts:137` (the agent's output goes into `log`)
- Input: the answer of `arthur remote-job records` on another machine: a job's log that grew by more than 1 MiB between two sweeps (the agent's whole JSON stream, an install's output), a large `result`; or a `records` that does not end (a machine whose network drops mid-call, a job there without a sandbox, such as on macOS, that changed Arthur's install there).
- Why the check misses it: `spawnSync`'s default `maxBuffer` is 1 MiB; past it Node kills ssh and sets `ENOBUFS` (probe: a 2 MiB stdout gave `status null signal SIGTERM error ENOBUFS`). `ssh` throws then, with no cause 255 (probe, the real `ssh()` with a fake `ssh` that prints 2 MiB: `thrown: machine mac: ssh: spawnSync ssh ENOBUFS | cause: undefined`), so the machine is neither copied nor held offline; `synced` is not moved, so the next sweep asks for the same bytes and fails the same way, every sweep. `ConnectTimeout=10` bounds only the connection: a `records` that never answers blocks `spawnSync`, and so `arthur run`'s whole event loop (Telegram, `/stopall`, every plugin) [INFERENCE: from the code, not run against a hanging machine].
- What: every job on that machine stays `working` here and never ends, its branch never fetched, its slot held; or Arthur stops answering altogether until the call ends.
- Suggestion: copy over `sshAsync` (as stop and continue already do) with a time limit, and a `records` answer cut to a byte budget: `records` sends at most N bytes of log per job and says where it stopped, so the next copy goes on from there; a timeout counts as unreachable (the grace applies). A test with a fake `remote-job records` that prints more than 1 MiB, and one that never ends.

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

- 2026-10-27: Source: F2 of AR0405
