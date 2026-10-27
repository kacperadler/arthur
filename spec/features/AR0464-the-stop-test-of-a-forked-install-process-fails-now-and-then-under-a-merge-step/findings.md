# AR0464 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A stop during the install can end the job before its stop of the install's group is over

- Kind: fix
- Found by: 2026-10-27-worker-296532a2 (worker), 2026-10-27
- Where: `packages/core/src/wrapper.ts:145`, `packages/core/src/wrapper.ts:148`
- What: `halt` starts `stopGroup` (SIGTERM to the group, the grace, then SIGKILL and the strays) into `stopping`, but only `play` awaits it (line 145). A stop during the install skips `play` (line 148), so the wrapper ends the job as soon as the install's `close` comes, which is at most 2 s after the install's own process exited (job-install.ts:17), while `stopGroup` may still be in its grace. On a host without a systemd user manager (no scope for `endScope` to kill), a process the install forked that ignores SIGTERM then outlives the job's `ended` state by up to the grace, until the SIGKILL, and the log line of that SIGKILL comes after `ended: stopped` [INFERENCE: read from the lines, not run]. It is also one reason why the test of AR0464 could see the forked process alive right after `arthur stop` returned.
- Suggestion: `await stopping` after the install too (before line 148 decides whether to play), with a test: an install that forks `trap '' TERM; sleep 300`, exits, and is stopped bare; the job's `ended` comes only after the SIGKILL line. Leaves the stop itself (job-stop.ts) as it is.
- Status: ticket AR0481

## F2. A failing run of the test leaves its `sleep 300` running for up to 5 minutes

- Kind: test
- Found by: 2026-10-27-review-2e8b9e13 (review), 2026-10-27
- Where: `packages/core/test/job-control.test.ts:124`
- What: if the test fails before its last line, the forked `sleep 300` is not killed; a `t.after` that kills it would remove it.
- Status: dropped (only after a failure, harmless, uses no production name, gone in 5 minutes)
