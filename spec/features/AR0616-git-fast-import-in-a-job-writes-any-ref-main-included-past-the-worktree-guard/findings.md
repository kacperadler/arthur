# AR0616 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A test run by `npm run mutate` leaves `sleep 300` processes behind

- Kind: test
- Found by: 2026-11-04-worker-6a0f19cc (worker), 2026-11-04
- Where: one of the tests that start `sleep 300` (`packages/core/test/job-control.test.ts:88`, `:121`, `:168`, `:185`, `:210`, `:223`, `:237`; `packages/core/test/scope.test.ts:51`, `:108`, `:126`, `:222`; `packages/delivery/test/merge.test.ts:282`); which one is not known
- What: after `npm run mutate -- --max 4` ended, two `sleep 300` processes started about three minutes before its end were still running, each in a process group of its own and reparented to `systemd --user` (`ps -o pid,ppid,pgid,etime,args`). The job's end check reported them; they were stopped with `kill`.
- Suggestion: run each candidate test file alone under `npm run mutate`'s conditions and see which leaves a `sleep 300`, then have that test kill the process it noted (its pid file) in a `t.after`. Out: the guard.
- Status: open
