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

- Kind: test
- Found by: 2026-10-25-worker-3ca726ff (worker), 2026-10-25
- Where: `packages/core/src/job-memory.ts:58`
- What: the job sandbox's Landlock ruleset lets nothing under `/proc` be written (job-sandbox.ts), and a test run inside a job inherits it. `oomFirst` checks only that `/proc/self/oom_score_adj` exists, then writes it, so the wrapper of every job a test spawns exits at once with `Error: EACCES: permission denied, open '/proc/self/oom_score_adj'` in `<home>/wrapper.log`; the record stays `working` and the agent never runs. Seen here: `node --import @arthur/core/testing --test --test-name-pattern="arthur stop ends a running job|ignores SIGTERM|left the agent's group|leaves the limit's state" packages/core/test/job-control.test.ts` fails all 4, each `timed out waiting for` the agent's first write; a throwaway test that spawned one job printed that wrapper.log. [INFERENCE] Every core test that waits for a spawned job's agent fails the same way inside a job; the full suite was not run here to count them.
- Suggestion: either `oomFirst` skips the raise when the file cannot be written (EACCES/EPERM; `arthur run` outside a sandbox still raises it), or those tests skip where `/proc/self/oom_score_adj` cannot be opened for writing, with one probe at load as this ticket's tmux tests do. The sandbox stays as it is.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: test

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0401
