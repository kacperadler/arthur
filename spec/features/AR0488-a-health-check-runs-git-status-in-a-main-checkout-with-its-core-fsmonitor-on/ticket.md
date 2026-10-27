# AR0488 - A health check runs `git status` in a main checkout with its `core.fsmonitor` on

```json
{
  "id": "AR0488",
  "title": "A health check runs `git status` in a main checkout with its `core.fsmonitor` on",
  "date": "2026-10-27"
}
```

## Description

F7 of AR0403 (spec/features/AR0403-security-review-of-our-own-code-part-2-injection-into-shell-git-ssh-and-tmux-and-prompt-injection/findings.md).

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-999ff80a (worker), 2026-10-27
- Where: `packages/manage/src/health-checks.ts:31` (`git -C <path>` with no `-c`), `:63` (`git status` in each project's main checkout), run by `health` in `arthur run` every `health.everyMinutes` (`packages/manage/src/manage.ts:66`) and at a restart (`packages/session/src/restart.ts:165`)
- Input: a main checkout's `.git/config` written by a program outside the job sandbox: a job on a host where the sandbox cannot be set up (`no sandbox: ...`, `packages/core/src/job-sandbox.ts:99`), or the coordinator (F2).
- Why the check misses it: every other git call that reads a main checkout's index carries `-c core.hooksPath=/dev/null -c core.fsmonitor=false` (`docs/deploy.md:38`); this one does not. Probe in a temporary repository whose config sets `core.fsmonitor` to `touch <dir>/ran; false`: the call as `health-checks.ts:63` runs it left `ran`; with `-c core.fsmonitor=false` it left nothing.
- What: a program named in the shared Git config runs as Arthur in `arthur run`'s process, outside every sandbox and scope, every few minutes.
- Suggestion: give `health-checks.ts`'s `git` the same `--no-replace-objects -c core.hooksPath=/dev/null -c core.fsmonitor=false` and the `configRefusal` check other main-checkout calls use, with a test on a repository whose config sets `core.fsmonitor`.

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

- 2026-10-27: Source: F7 of AR0403
