# AR0481 - A stop during the install can end the job before its stop of the install's group is over

```json
{
  "id": "AR0481",
  "title": "A stop during the install can end the job before its stop of the install's group is over",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0464 (spec/features/AR0464-the-stop-test-of-a-forked-install-process-fails-now-and-then-under-a-merge-step/findings.md).

- Kind: fix
- Found by: 2026-10-27-worker-296532a2 (worker), 2026-10-27
- Where: `packages/core/src/wrapper.ts:145`, `packages/core/src/wrapper.ts:148`
- What: `halt` starts `stopGroup` (SIGTERM to the group, the grace, then SIGKILL and the strays) into `stopping`, but only `play` awaits it (line 145). A stop during the install skips `play` (line 148), so the wrapper ends the job as soon as the install's `close` comes, which is at most 2 s after the install's own process exited (job-install.ts:17), while `stopGroup` may still be in its grace. On a host without a systemd user manager (no scope for `endScope` to kill), a process the install forked that ignores SIGTERM then outlives the job's `ended` state by up to the grace, until the SIGKILL, and the log line of that SIGKILL comes after `ended: stopped` [INFERENCE: read from the lines, not run]. It is also one reason why the test of AR0464 could see the forked process alive right after `arthur stop` returned.
- Suggestion: `await stopping` after the install too (before line 148 decides whether to play), with a test: an install that forks `trap '' TERM; sleep 300`, exits, and is stopped bare; the job's `ended` comes only after the SIGKILL line. Leaves the stop itself (job-stop.ts) as it is.

## Goal

A stop that comes during a job's install ends the job only after the stop of the install's process group is over. Today `halt` starts `stopGroup` into `stopping`, but only `play` awaits it (`packages/core/src/wrapper.ts:145`); a stop during the install skips `play` (`:148`), so the job reaches `ended: stopped` while a forked process that ignores SIGTERM may still run until the grace's SIGKILL, on a host without a systemd user manager. F1 of AR0464.

- Kind: fix

## Done means

- After the install, the wrapper awaits `stopping` before it decides whether to play; the job's `ended` comes after the stop of the install's group.
- A test: an install that forks `trap '' TERM; sleep 300`, exits, and is stopped bare (no user manager); the job's `ended` comes only after the SIGKILL line of the stop, and the forked process is gone. It fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/wrapper.ts`: await `stopping` after the install.
- `packages/core/test/job-control.test.ts`: the test above.

Out:
- The stop itself (`job-stop.ts`) stays as it is.

## Decisions

- 2026-10-27: Source: F1 of AR0464
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
