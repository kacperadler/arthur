# AR0066 - A process that holds the agent's stdout open keeps the wrapper from ending the job

```json
{
  "id": "AR0066",
  "title": "A process that holds the agent's stdout open keeps the wrapper from ending the job",
  "date": "2026-10-16"
}
```

## Description

the wrapper reads the agent until its stdout and stderr close, not until it exits. A process the agent started with those pipes inherited keeps them open after the agent exits: the test "a stop that comes once the agent exited on its own leaves the job's own ending" (`job-control.test.ts`) relies on a `sleep 2 &` doing so for two seconds. A daemon that never closes them leaves the job `running` forever, since `endScope`, which would kill it, runs only after `close`. [INFERENCE: omp's bash tool gives the commands it runs pipes of its own, so only a process omp itself starts this way is affected.]

## Goal

A job always ends when its agent exits: a background process that keeps the agent's stdout open cannot hold the job at running.

- Kind: security

Evidence:
- `packages/core/src/wrapper.ts` (`play`, which waits for the agent's `close`)
- Found by: 2026-10-16-ar0017-stop-continue-ste-6a96b243 (worker), 2026-10-16

## Done means

- After the agent exits, the wrapper waits at most a short grace (2 s) for the pipes to close, then stops reading, ends the scope (killing the holder), and writes the final files and `state`.
- A test with the fake agent: it starts a background `sleep` holding stdout and exits 0; the job ends `done` within the grace plus a second, and the `sleep` is gone.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/wrapper.ts`, `job-stop.ts`, their tests.

## Decisions

- 2026-10-16: Source: F2 of AR0017
- 2026-10-16: Coordinator: core line budget 4224 -> 4226 for the 2-line pipe grace in wrapper.ts.
