# AR0543 - Inside a job's sandbox the agent cannot read or stop a command omp moved to the background

```json
{
  "id": "AR0543",
  "title": "Inside a job's sandbox the agent cannot read or stop a command omp moved to the background",
  "date": "2026-10-28"
}
```

## Description

F2 of AR0456 (spec/features/AR0456-the-agent-s-own-npm-ci-cannot-write-npm/findings.md).

- Kind: fix
- Found by: 2026-10-28-worker-0197a47f (worker), 2026-10-28
- Where: `packages/core/src/job-sandbox.ts:9-15` (the seccomp filter that refuses a Unix stream socket)
- What: omp moves a long `bash` call (here `npm test`) to the background as `bg_<n>`; reading `proc://bg_1` or writing `proc://bg_1/kill` from a job's agent failed with `Failed to start daemon broker at ~/.omp/run/daemons/<hash>/broker.sock after 10s: connect EACCES`. So a worker cannot wait on its own suite run in the same turn, only end its turn and be woken; the result does arrive as an injected notice.
- Suggestion: let omp's broker socket through, as omp's session lock's datagram socket is (AR0406), or keep long commands in the foreground for a job's agent; the first widens what a job reaches outside its sandbox (the broker runs outside it), so it needs weighing.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: fix

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-28: Source: F2 of AR0456
