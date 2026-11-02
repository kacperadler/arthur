# AR0569 - Outcome

- Merged: 2026-10-30, `cdb0abdc`
- Branch: arthur/2026-10-30-worker-e6fc74de
- Reviews: review-1.md PASS
- Cost: worker $4.39, reviews $1.56; review rounds 1

## What went in

- `packages/delivery/src/checks-extension.ts`: a check call (npm run check, npm test) with no timeout or a shorter one runs with 1800 s; a longer one keeps its own.
- `packages/core/src/fake-agent.ts`: applies the `input` a `tool_call` handler returns, as omp 18.3.0 does.
- `packages/core/src/worktree-guard.ts`: refuses `pkill` and `killall` wherever the guard finds a verb (`bash -c`, `eval`, `sudo` included); `kill <pid>` still passes.
- `packages/core/src/job-commands.ts`, `packages/core/src/cli.ts`: `arthur steer`, `arthur continue` and `/steer` emit `job-steered` (`id`, `kind`, `text`, `via`); a plugin's own steer or continue emits none.
- `packages/core/roles/worker.md`: the 1800 s line is gone, the extension sets it.
- `docs/plugin-api.md`, `packages/core/docs/commands/{continue,spawn,steer}.md`, `packages/delivery/docs/commands/review-needed.md`: say the above.
- `packages/core/test/{job-records,testing,worktree-guard,wrapper}.test.ts`, `packages/delivery/test/checks.test.ts`: tests of each.
- `test/structure.test.ts`: line budgets core 6470 to 6476, core/testing 349 to 351, delivery 1734 to 1737 (AR-D355).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1258/1326 passed.

## Left open

- Deferred (client summary): F1. job-steered's kind is pinned only for worker jobs.
- Deferred (client summary): F2. The fake agent's last-answer-without-input case is untested.
- Deferred (client summary): F3. Ways around the pkill refusal.
- Deferred (client summary): F4. The commit subjects use scope core, not the ticket id.
- Deferred (client summary): F5. cli.ts changed outside the file list.
