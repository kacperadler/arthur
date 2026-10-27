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

A secret value the coordinator's start passes again to a stale tmux server sits for milliseconds in the tmux client's command line, readable by other local users (finding above).

- Kind: security

## Done means

- A value that differs on a stale server reaches the coordinator without appearing in any process's argv; a test in `packages/orchestration/test/coordinator.test.ts` (host only, tmux) that fails without the fix.

## Scope

In:
- `packages/orchestration/src/coordinator.ts`, its test.

Out:
- The `ARTHUR_*` variables, which hold no secret.

## Decisions

- 2026-10-26: Source: F1 of AR0434
- 2026-10-27: AR0465 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D130)
