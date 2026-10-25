# AR0376 - Outcome

- Merged: 2026-10-25, `75df243f`
- Branch: h/2026-10-24-ar0376-job-sandbox-retry-6b3fc3f2
- Reviews: review-1.md PASS
- Cost: worker $9.30, reviews $1.03; review rounds 1

## What went in

- `packages/core/src/job-sandbox.ts` (new): each job's agent starts under Landlock (writes only to its worktree, record, the Git folders a commit on its branch needs but not `config` or `hooks`, `$TMPDIR`, `/dev`, `~/.omp`, its plugin folders), seccomp (no Unix sockets, no io_uring, so no user bus or `systemd-run --user`) and `no_new_privs`; where it cannot be set up (macOS, no python3, no Landlock) the job's log says `no sandbox: <why>`.
- `packages/core/src/wrapper.ts`: starts the agent through the sandbox. Landlock instead of bubblewrap (bubblewrap cannot run on this host); Decision in the ticket.
- Tests: `packages/core/test/sandbox.test.ts` (permitted writes succeed, others refused, a real job commits on its branch), `scope.test.ts` adjusted. Docs: `spawn.md` "The sandbox", `docs/deploy.md` threat model and limits. `test/structure.test.ts`: core 6156 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1104/1104 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40180977288

## Left open

- Tickets from findings: AR0401 (F1).
