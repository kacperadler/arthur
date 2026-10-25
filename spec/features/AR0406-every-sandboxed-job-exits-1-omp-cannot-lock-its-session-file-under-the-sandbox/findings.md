# AR0406 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A job's Unix datagram socket reaches any local daemon that listens on one

- Kind: security
- Found by: 2026-10-25-worker-85b11402 (worker), 2026-10-25
- Where: `packages/core/src/job-sandbox.ts:36` (the seccomp `program`)
- What: to let omp take its session lock, the filter now passes `socket(AF_UNIX, SOCK_DGRAM)`. seccomp cannot see the address of a later `sendto`/`connect`, so the same socket can also send to any datagram socket on the host that the user may write: journald's `/run/systemd/journal/socket`, `/dev/log`, a service's `NOTIFY_SOCKET`. [INFERENCE: none of these runs a command; at worst a job writes forged lines into the user's journal. Not tried.] The stream and seqpacket sockets that reach the user bus, tmux and ssh/gpg agents stay refused (`node --test packages/core/test/sandbox.test.ts`, the lock test, where this process may make sockets).
- Suggestion: list it among the sandbox's limits in `packages/core/docs/commands/spawn.md` and `docs/deploy.md`; on Linux 6.12 or later, Landlock's `LANDLOCK_SCOPE_ABSTRACT_UNIX_SOCKET` could keep a job off abstract sockets outside its own domain, but omp's lock is abstract and its own, so check that first. Out: refusing datagram sockets again, which breaks every job (AR0406).
- Status: open
