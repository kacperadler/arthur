# AR0360 - The job's record of its checks is its own word: written from inside the agent, not tied to the tip's tree, not stale after a change by bash

```json
{
  "id": "AR0360",
  "title": "The job's record of its checks is its own word: written from inside the agent, not tied to the tip's tree, not stale after a change by bash",
  "date": "2026-10-23"
}
```

## Description

three inputs the check does not cover. A line written by anything in the job but the extension: the branch's own `test` script runs under `npm test` with `ARTHUR_JOB` in its environment and the same user, and the worktree guard reads tool calls, not what a program does (AR0320, "Writes outside the guard's view"). A change after the run that no tool call made: `sed -i`, `git checkout`, `git apply`, `git commit --amend` keep the lines fresh. A run on a tree other than the tip's: the lines name no commit, so a run before the last commit, or with uncommitted changes, is as good as one on the tip.

## Goal

The record of a job's checks is tied to the tree it ran on and marked stale after any later change, so `review-needed` cannot rest on old results; tested.

- Kind: risk

Evidence:
- `packages/delivery/src/checks-extension.ts:14-23` (appended inside the agent's process from the tool result's text), `:27-30` (`stale` from `edit`/`write` tool calls only; `docs/commands/review-needed.md:35` names the bash limit), `packages/delivery/src/review-needed.ts:37`, `:78-83` (the file believed as it is, its last fresh lines deciding `no review`)
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: each line the extension writes ends with the worktree's `git rev-parse HEAD` and `clean` or `dirty` (`git status --porcelain --untracked-files=no` empty or not) at the run's end; `review-needed` takes a `check`/`test` line only when its commit is the tip and the tree was clean, else `review: … the job's checks ran on <commit>, not the tip` or `… on a dirty tree`; `stale` then goes. The writer (a program in the job writing the home folder) is AR0329's sandbox; until it lands, the lines are a hint the sandbox makes a record. Tests in `checks.test.ts`: the suffix of a clean and a dirty tree; `review-needed.test.ts`: a passing line on an older commit and one on a dirty tree answer `review`, one on the tip `no review`.
- `npm test` and `npm run check` pass.

## Scope

In:
- each line the extension writes ends with the worktree's `git rev-parse HEAD` and `clean` or `dirty` (`git status --porcelain --untracked-files=no` empty or not) at the run's end; `review-needed` takes a `check`/`test` line only when its commit is the tip and the tree was clean, else `review: … the job's checks ran on <commit>, not the tip` or `… on a dirty tree`; `stale` then goes. The writer (a program in the job writing the home folder) is AR0329's sandbox; until it lands, the lines are a hint the sandbox makes a record. Tests in `checks.test.ts`: the suffix of a clean and a dirty tree; `review-needed.test.ts`: a passing line on an older commit and one on a dirty tree answer `review`, one on the tip `no review`.

## Decisions

- 2026-10-23: Source: F4 of AR0324
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
