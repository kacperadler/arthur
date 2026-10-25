# AR0406 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A job's Unix datagram socket reaches any local daemon that listens on one

- Kind: security
- Found by: 2026-10-25-worker-85b11402 (worker), 2026-10-25
- Where: `packages/core/src/job-sandbox.ts:36` (the seccomp `program`)
- What: to let omp take its session lock, the filter now passes `socket(AF_UNIX, SOCK_DGRAM)`. seccomp cannot see the address of a later `sendto`/`connect`, so the same socket can also send to any datagram socket on the host that the user may write: journald's `/run/systemd/journal/socket`, `/dev/log`, a service's `NOTIFY_SOCKET`. [INFERENCE: none of these runs a command; at worst a job writes forged lines into the user's journal. Not tried.] The stream and seqpacket sockets that reach the user bus, tmux and ssh/gpg agents stay refused (`node --test packages/core/test/sandbox.test.ts`, the lock test, where this process may make sockets).
- Suggestion: list it among the sandbox's limits in `packages/core/docs/commands/spawn.md` and `docs/deploy.md`; on Linux 6.12 or later, Landlock's `LANDLOCK_SCOPE_ABSTRACT_UNIX_SOCKET` could keep a job off abstract sockets outside its own domain, but omp's lock is abstract and its own, so check that first. Out: refusing datagram sockets again, which breaks every job (AR0406).
- Status: ticket AR0407

## F2. A review's filing after a sandboxed run is not tested

- Kind: test
- Found by: 2026-10-25-review-6e19990f (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/test/sandbox.test.ts:220`
- What: The job test checks that a sandboxed review run ends `finished` with its `PASS` verdict accepted, not that delivery then files it.
- Status: dropped (filing comes after `finished` in delivery, which this branch does not change and whose own tests cover it)

## F3. Two older sandbox tests now also skip inside a job

- Kind: test
- Found by: 2026-10-25-review-6e19990f (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/test/sandbox.test.ts`
- What: "a Unix socket is refused..., TCP still connects" and "a job's agent writes its worktree..." now skip inside a job as well as on a host without the sandbox.
- Status: dropped (they always failed inside a job, where the test process cannot make a Unix socket; outside a job they run, and passed 9/9 on the coordinator's run)

## F4. The datagram socket reaches journald and systemd's notify sockets

- Kind: security
- Found by: 2026-10-25-review-6e19990f (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/job-sandbox.ts:36`
- What: The review confirms F1 by tracing: journald's sockets take forged lines (stamped with the job's scope), systemd notify refuses scopes, abstract names are only omp's locks; Landlock's abstract-socket scope needs Linux 6.12, this host runs 6.8. The docs still do not list these among the sandbox's limits.
- Status: ticket AR0407

## F5. The core is at exactly its line budget

- Kind: refactor
- Found by: 2026-10-25-review-6e19990f (reviewer, non-blocking note), 2026-10-25
- Where: `test/structure.test.ts`
- What: Core source is 6156 lines, its budget; the worker cut a comment line to stay under it.
- Status: dropped (no defect; the next core change that needs a line raises the budget as the owner's decision, `--kind budget`)
