# AR0585 - Outcome

- Merged: 2026-10-30, `81dd75ff`
- Branch: arthur/2026-10-30-worker-3a3e2dc3
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.03, reviews $0.73; review rounds 2

## What went in

- packages/delivery/src/processes-extension.ts: new OMP job extension; at `session_stop` it names the job's leftover processes (everything in the job's scope, or the agent's descendants when the job runs bare, minus the agent and its wrapper) once per run, and continues the run with a reminder to stop them and repeat the final message.
- packages/delivery/src/delivery.ts: registers the checks and processes extensions in one loop, which keeps the file at 200 lines.
- packages/delivery/test/processes.test.ts: fake-agent tests. One leftover gives exactly one reminder, with `@` guarded, and no second one. A child's child is named. There is no reminder when no process is left, when `ps` is missing, or outside a job. In the job's scope a setsid daemon is named, and the agent and its parent are not.
- packages/delivery/docs/delivery.md: new section "Processes a job leaves running".
- test/structure.test.ts: a single delivery line budget of 1895 (main had 1844).
- spec/features/AR0585-before-a-job-ends-the-agent-is-reminded-to-close-the-processes-it-started-that/findings.md: new, with F1 (MCP servers may be named as leftovers).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1332/1401 passed.

## Left open

- Deferred (client summary): F1. A job's MCP servers would be named as leftover processes
- Deferred (client summary): F2. no test checks that `processes-extension.ts` is registered
