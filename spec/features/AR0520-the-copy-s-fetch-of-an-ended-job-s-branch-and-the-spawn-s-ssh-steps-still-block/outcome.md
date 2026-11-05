# AR0520 - Outcome

- Merged: 2026-11-05, `c4d4abc7`
- Branch: arthur/2026-11-05-worker-d8bfe3a6
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $6.50, reviews $1.09; review rounds 2

## What went in

- packages/core/src/job-machine.ts: every ssh and git-over-ssh step has a time and output limit (60 s and 1 MiB; 600 s for a base's push). An ssh step past its limit fails like an unreachable machine (`cause` 255), naming the machine and the step; a fetch or push fails as `git fetch: …` or `git push: …`. `gitOver`, `reach`, `addThere` and `removeThere` are async, and a push error names the machine.
- packages/core/src/machine-sync.ts: the sweep's fetch of an ended job's branch is awaited without blocking, and a job another sweep ended during that fetch is skipped; `launchThere` uses `sshAsync`.
- packages/core/src/jobs.ts: the spawn awaits `reach`, `addThere` and `removeThere`.
- packages/core/test/machine.test.ts: tests for the ssh time and output limits; the spawn's step and the sweep's fetch ending at 60 s while the process keeps answering, with the next sweep bringing the branch; the add, launch and remove steps not blocking; the push limit at exactly 600 s; one `job-ended` when two sweeps' fetches overlap; the push refusal message now starts with the machine.
- packages/core/docs/commands/spawn.md: documents the limits and their messages, the push refusal starting with the machine, and the step named in the records copy's cut messages.
- spec/features/AR0520-the-copy-s-fetch-of-an-ended-job-s-branch-and-the-spawn-s-ssh-steps-still-block/findings.md: F1 (steer and prune still block up to 60 s) and F2 (a killed git leaves its ssh running), both open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1491/1562 passed.

## Left open

- Deferred (client summary): F1. A steer or a prune of a job on another machine still holds up `arthur run` for up to 60 s
- Deferred (client summary): F2. A killed fetch or push leaves git's ssh child running
- Deferred (client summary): F3. `steer` and `prune` still use the blocking `ssh`, so each can freeze `arthur run` for up to 60 s
- Deferred (client summary): F4. when `gitOver` hits its limit, it kills only `git`, so the `ssh` that git started keeps running
