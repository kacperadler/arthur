# AR0080 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The wrapper test of a finished worker fails in a full `npm test` run from a job's worktree

- Kind: bug
- Found by: 2026-10-17-ar0080-27036b90 (worker), 2026-10-17
- Where: `packages/core/test/wrapper.test.ts:126`, `packages/core/src/worktree-guard.ts:169-171`
- What: `a finished worker: the agent gets the worker's tools, model, thinking and prompt; ...` failed in each of 3 full `npm test` runs in this worktree (`/home/kacper/.arthur-worktrees/2026-10-17-ar0080-27036b90`), and also in a copy of HEAD (96e8006, without this ticket's change) extracted inside that worktree. The job's `log` holds the worktree guard's `worktree guard: the project list is unreadable (ENOENT ... home/projects/checkouts) ...` line between `read README.md` and `bash npm test`, and the test's regex wants the four tool lines one after another. The file alone passed 3 of 3 runs, and the full suite passed in copies of HEAD and of this branch under `/tmp`. [INFERENCE: the guard appends its line from the agent's process while the wrapper writes the tool lines from the agent's output, so the order depends on timing; AR0092 added the line.]
- Suggestion: the test drops the guard's fallback line before it matches the tool lines, or its home gets a `projects/checkouts` file so the guard has no fallback to report.
- Status: open
