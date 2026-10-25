# AR0407 - A job's Unix datagram socket reaches any local daemon that listens on one

```json
{
  "id": "AR0407",
  "title": "A job's Unix datagram socket reaches any local daemon that listens on one",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0406 (spec/features/AR0406-every-sandboxed-job-exits-1-omp-cannot-lock-its-session-file-under-the-sandbox/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-85b11402 (worker), 2026-10-25
- Where: `packages/core/src/job-sandbox.ts:36` (the seccomp `program`)
- What: to let omp take its session lock, the filter now passes `socket(AF_UNIX, SOCK_DGRAM)`. seccomp cannot see the address of a later `sendto`/`connect`, so the same socket can also send to any datagram socket on the host that the user may write: journald's `/run/systemd/journal/socket`, `/dev/log`, a service's `NOTIFY_SOCKET`. [INFERENCE: none of these runs a command; at worst a job writes forged lines into the user's journal. Not tried.] The stream and seqpacket sockets that reach the user bus, tmux and ssh/gpg agents stay refused (`node --test packages/core/test/sandbox.test.ts`, the lock test, where this process may make sockets).
- Suggestion: list it among the sandbox's limits in `packages/core/docs/commands/spawn.md` and `docs/deploy.md`; on Linux 6.12 or later, Landlock's `LANDLOCK_SCOPE_ABSTRACT_UNIX_SOCKET` could keep a job off abstract sockets outside its own domain, but omp's lock is abstract and its own, so check that first. Out: refusing datagram sockets again, which breaks every job (AR0406).
- F4 of AR0406, the review's trace: journald's `journal/socket`, `dev-log` and `syslog` take forged lines (stamped with the job's scope); systemd's notify sockets refuse a scope; the abstract names are only omp's own locks; Landlock's abstract-socket scope needs Linux 6.12, this host runs 6.8.

## Goal

The sandbox's docs name what a job can reach through the Unix datagram socket AR0406 allowed, so the owner knows the bound. Evidence: AR0406 F1 and F4 (review 2026-10-25-review-6e19990f traced it): journald's `journal/socket`, `dev-log` and `syslog` take lines from a job, stamped with its `arthur-job-<id>.scope`; systemd's notify sockets refuse a scope; the only abstract names are omp's own locks; stream sockets (user bus, tmux, ssh/gpg agents) stay refused with `EPROTOTYPE`. Nothing can close it on this host: Landlock's `LANDLOCK_SCOPE_ABSTRACT_UNIX_SOCKET` needs Linux 6.12 (this host: 6.8) and covers abstract names only, not journald's path sockets.

- Kind: security

## Done means

- `arthur spawn --help`, "The sandbox", and docs/deploy.md's sandbox entry list this limit: a job may write lines into the journal, traceable to its scope, and nothing beyond; the project's checks pass.

## Scope

In:
- `packages/core/docs/commands/spawn.md`: "The sandbox" names the limit.
- `docs/deploy.md`: its sandbox entry (line 35) names it in one sentence.

Out:
- Any change to the seccomp filter: refusing datagram sockets breaks every job (AR0406).
- Landlock's abstract-socket scope: a later ticket once a host runs Linux 6.12 or later.

## Decisions

- 2026-10-25: Source: F1 of AR0406
- 2026-10-25: AR0407 approved by the owner; worker starts in turn; the owner: "ok, go with AR0407 now, and i approve the AR0408–AR0411 tasks, you can go to a 60% usage so when you complete this tasks take another one, always go with your recommendations and do not ask me about them, go to 60% usage and complete as many tasks as you can" (AR-D6)
