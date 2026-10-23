# AR0100 - The wrapper test of a finished worker fails in a full `npm test` run from a job's worktree

```json
{
  "id": "AR0100",
  "title": "The wrapper test of a finished worker fails in a full `npm test` run from a job's worktree",
  "date": "2026-10-17"
}
```

## Description

`a finished worker: the agent gets the worker's tools, model, thinking and prompt; ...` failed in each of 3 full `npm test` runs in this worktree (`/home/kacper/.arthur-worktrees/2026-10-17-ar0080-27036b90`), and also in a copy of HEAD (96e8006, without this ticket's change) extracted inside that worktree. The job's `log` holds the worktree guard's `worktree guard: the project list is unreadable (ENOENT ... home/projects/checkouts) ...` line between `read README.md` and `bash npm test`, and the test's regex wants the four tool lines one after another. The file alone passed 3 of 3 runs, and the full suite passed in copies of HEAD and of this branch under `/tmp`. [INFERENCE: the guard appends its line from the agent's process while the wrapper writes the tool lines from the agent's output, so the order depends on timing; AR0092 added the line.]

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: fix

Evidence:
- `packages/core/test/wrapper.test.ts:126`, `packages/core/src/worktree-guard.ts:169-171`
- Found by: 2026-10-17-ar0080-27036b90 (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: the test drops the guard's fallback line before it matches the tool lines, or its home gets a `projects/checkouts` file so the guard has no fallback to report.
- `npm test` and `npm run check` pass.

## Scope

In:
- the test drops the guard's fallback line before it matches the tool lines, or its home gets a `projects/checkouts` file so the guard has no fallback to report.

## Decisions

- 2026-10-17: Source: F1 of AR0080
