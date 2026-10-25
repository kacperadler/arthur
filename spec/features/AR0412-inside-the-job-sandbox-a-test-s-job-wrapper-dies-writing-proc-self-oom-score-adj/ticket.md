# AR0412 - Inside the job sandbox, a test's job wrapper dies writing /proc/self/oom_score_adj, so its agent never starts

```json
{
  "id": "AR0412",
  "title": "Inside the job sandbox, a test's job wrapper dies writing /proc/self/oom_score_adj, so its agent never starts",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0401 (spec/features/AR0401-inside-a-sandboxed-job-the-orchestration-tests-that-start-a-tmux-server-fail/findings.md).

- Kind: fix
- Found by: 2026-10-25-worker-3ca726ff (worker), 2026-10-25
- Where: `packages/core/src/job-memory.ts:58`
- What: the job sandbox's Landlock ruleset lets nothing under `/proc` be written (job-sandbox.ts), and a test run inside a job inherits it. `oomFirst` checks only that `/proc/self/oom_score_adj` exists, then writes it, so the wrapper of every job a test spawns exits at once with `Error: EACCES: permission denied, open '/proc/self/oom_score_adj'` in `<home>/wrapper.log`; the record stays `working` and the agent never runs. Seen here: `node --import @arthur/core/testing --test --test-name-pattern="arthur stop ends a running job|ignores SIGTERM|left the agent's group|leaves the limit's state" packages/core/test/job-control.test.ts` fails all 4, each `timed out waiting for` the agent's first write; a throwaway test that spawned one job printed that wrapper.log. [INFERENCE] Every core test that waits for a spawned job's agent fails the same way inside a job; the full suite was not run here to count them.
- Suggestion: either `oomFirst` skips the raise when the file cannot be written (EACCES/EPERM; `arthur run` outside a sandbox still raises it), or those tests skip where `/proc/self/oom_score_adj` cannot be opened for writing, with one probe at load as this ticket's tmux tests do. The sandbox stays as it is.

## Goal

A job's wrapper starts its agent where `/proc/self/oom_score_adj` exists but cannot be written (inside a job's sandbox, whose Landlock ruleset refuses writes under `/proc`), so `npm test` passes inside a job as AR0401 meant. Evidence: `packages/core/src/job-memory.ts:57-63` (`oomFirst` checks only `existsSync`, then `writeFileSync`); inside a job, the wrapper of every job a test spawns exits with `EACCES: permission denied, open '/proc/self/oom_score_adj'`, and about 40 job-spawning tests time out (AR0401 F1, F4; review 2026-10-25-review-f406ba8e).

- Kind: test

## Done means

- `oomFirst` runs `start` and returns what it returns when the file cannot be written (EACCES or EPERM), without raising the score; where it can be written it still raises it to 1000 for `start` and restores it, and any other error still throws.
- A test in `packages/core/test/scope.test.ts` (beside its `oom_score_adj` tests) that fails before the change: `oomFirst` where the write is refused still starts. Where the test process can write the file, it shows the refusal another way (a probe or a path made unwritable), not by skipping.
- `npm run check` and the project's checks pass; inside a job, `node --test packages/core/test/job-control.test.ts` passes.

## Scope

In:
- `packages/core/src/job-memory.ts`: `oomFirst` skips the raise when the write is refused.
- `packages/core/test/scope.test.ts`: the test.

Out:
- Any change to the sandbox (`job-sandbox.ts`): `/proc` stays unwritable for a job.
- Skipping job-spawning tests instead of the fix.

## Decisions

- 2026-10-25: Source: F1 of AR0401
