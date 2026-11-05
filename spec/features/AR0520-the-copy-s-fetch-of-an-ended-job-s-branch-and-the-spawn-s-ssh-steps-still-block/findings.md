# AR0520 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A steer or a prune of a job on another machine still holds up `arthur run` for up to 60 s

- Kind: security
- Found by: 2026-11-05-worker-d8bfe3a6 (worker), 2026-11-05
- Where: `packages/core/src/job-records.ts:65` (`steer`), `:164` (`prune`'s `ssh(... "prune" ...)`), both through the synchronous `ssh` of `packages/core/src/job-machine.ts:118`
- What: AR0520 bounds `ssh` to 60 s and 1 MiB, but it stays `spawnSync`, because `host.jobs.steer` and `host.jobs.prune` answer synchronously: a `/steer` or a prune of a job on a machine that stopped answering mid-call freezes the event loop (Telegram, `/stopall`, every plugin) for up to 60 s per job; a prune of many such jobs, 60 s each in turn.
- Suggestion: make `steer` and `prune` of the host API return promises and call `sshAsync`, then delete `ssh`; every plugin caller and `docs/plugin-api.md` change with it. Out: the limits themselves.
- Status: open

## F2. A killed fetch or push leaves git's ssh child running

- Kind: perf
- Found by: 2026-11-05-worker-d8bfe3a6 (worker), 2026-11-05
- Where: `packages/core/src/job-machine.ts:94` (`execute` kills only the process it started)
- What: past its limit `gitOver` kills `git` (SIGKILL), not the `ssh` git started; that ssh lives on until its connection ends. On a link that hangs without closing, each sweep's timed-out fetch can leave one more ssh behind. [INFERENCE: from the code and the test's fake, whose ssh outlived git until its gate opened; not run against a real hanging link.]
- Suggestion: spawn `git` in its own process group (`detached: true`) and kill the group (`process.kill(-pid, "SIGKILL")`) in `execute`'s cut, or add `-o ServerAliveInterval=15 -o ServerAliveCountMax=3` to `OPTIONS`.
- Status: open
