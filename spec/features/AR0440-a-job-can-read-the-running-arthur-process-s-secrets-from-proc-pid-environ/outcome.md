# AR0440 - Outcome

- Merged: 2026-10-26, `6ce62c51`
- Branch: arthur/2026-10-26-worker-8dba5348
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $1.27, reviews n/a; review rounds 2

## What went in

- `packages/core/test/sandbox.test.ts`: a sandboxed job's command reading `/proc/<pid>/environ` of the `arthur run` that spawned it (a runner child started with a secret) gets `Permission denied`; the test's own control read finds the secret. No source file changed: the Landlock domain already refuses it (plan option 1, AR-D64).
- `packages/core/docs/commands/spawn.md` (The sandbox), `docs/deploy.md` (threat model): a job cannot read the environment or memory of a process outside its sandbox (`cmdline` stays readable); without the sandbox it reads every same-user process's environment, so secrets stay in the env file.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1161/1167 passed.

## Left open

- F1: the install and merge checks outside the sandbox, carried by AR0449 (AR-D65); AR0451 dropped as its duplicate.
