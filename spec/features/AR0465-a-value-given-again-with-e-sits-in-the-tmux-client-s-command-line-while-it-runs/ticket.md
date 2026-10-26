# AR0465 - A value given again with `-e` sits in the tmux client's command line while it runs

```json
{
  "id": "AR0465",
  "title": "A value given again with `-e` sits in the tmux client's command line while it runs",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0434 (spec/features/AR0434-a-secret-named-variable-only-the-coordinator-s-omp-holds-is-no-longer-redacted/findings.md).

- Kind: security
- Found by: 2026-10-26-worker-8b07846f (worker), 2026-10-26
- Where: `packages/orchestration/src/coordinator.ts:143`
- What: when the coordinator's tmux server already runs with a global value that differs from `arthur run`'s (a server started from another shell), the start passes `arthur run`'s value as `-e NAME=value` of `tmux new-session`, so it is in that tmux client's argv (`/proc/<pid>/cmdline`, readable by other local users without `hidepid`) for the few milliseconds the client runs. [INFERENCE] not measured; the case needs a stale server, and the same server's global environment already holds the old value.
- Suggestion: carry such a value by name only, through tmux's `update-environment` (the client's own environment, copied by `new-session`), or kill a server that holds no session but the coordinator's before the start. Out: the `ARTHUR_*` variables, which hold no secret.

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

- 2026-10-26: Source: F1 of AR0434
