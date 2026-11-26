# AR0740 - Outcome

- Merged: 2026-11-26, `f2835f2f`
- Branch: arthur/2026-11-25-worker-ab0e1866
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.06, reviews $1.22; review rounds 2

## What went in

- packages/core/docs/commands/jobs.md: lists `limit: memory: ...` (an out-of-memory kill included) and `limit: loop: ...` among the ways a job ends.
- packages/core/docs/commands/spawn.md: says an out-of-memory kill in a job's scope ends it `limit: memory: ...`, with the kernel's lines in its log, not `stopped`. Main's `limit: loop` rule sits beside it.
- packages/core/docs/commands/stop.md: says that when systemd sends SIGTERM after an out-of-memory kill, it is not `arthur stop` and the job does not end `stopped`.
- packages/core/src/job-scope.ts: passes `ARTHUR_TEST_SCOPE` to the wrapper, but only under node's test runner.
- packages/core/src/wrapper.ts: on SIGTERM it asks the memory watch first and ends `limit: memory: ...` after an out-of-memory kill. Any other SIGTERM is still `arthur stop`. It keeps main's loop stop.
- packages/core/test/job-control.test.ts: checks that a job's wrapper leads a process group of its own.
- packages/core/test/scope.test.ts: tests on a real scope: an allocation past a small cap ends with a memory reason, and a real `arthur stop` still ends `stopped`.
- spec/features/AR0740-an-out-of-memory-kill-in-a-job-is-recorded-as-an-arthur-stop-so-nobody-can-tell/findings.md: F1 and F2, both open.
- test/structure.test.ts: the core line budget is 7682, which covers this branch and AR0739 together.
- packages/core/src/job-memory.ts: not described
- packages/core/test/job-memory.test.ts: not described

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1908/1980 passed.

## Left open

- Deferred (client summary): F1. The tests of the kernel's and systemd's part never run inside a job
- Deferred (client summary): F2. A job that runs bare does not see an out-of-memory kill
