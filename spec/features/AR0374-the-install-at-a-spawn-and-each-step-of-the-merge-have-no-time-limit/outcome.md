# AR0374 - Outcome

- Merged: 2026-10-27, `a5779445`
- Branch: arthur/2026-10-26-worker-5ba085de
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $5.83, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/merge-checks.ts`: each step of `arthur merge` on main runs under a time limit, delivery's option `merge.stepSeconds` (default 3600 s); a step past it gets SIGKILL and is reported `<command>: failed, timed out after <n> s.`; any step that ends without exiting shows its error. The sweep of planted `.git` (AR0463) still runs after a step that timed out.
- `packages/delivery/src/delivery-options.ts`: the options are checked through the option table, so `merge.stepSeconds` is known and a value that is not a whole number of at least 1 is refused.
- `packages/core/src/wrapper.ts`: the install at a job's start is bounded by the job's own timeout; when that hits during the install, the log says `limit: time: stopping the install`, the job ends `... during its install`, and no agent starts.
- Docs: `merge.md`, `delivery.md`, `projects.md`, `spawn.md`, `stop.md`, `arthur.config.example.ts`. `test/structure.test.ts`: delivery's line budget is 1513 (AR-D110).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1121/1188 passed.

## Left open

- Tickets from findings: AR0468 (F1: a second `arthur merge` started during the first one's checks would merge on top of its unchecked commit).
- The reviews' other notes: dropped (findings.md).
