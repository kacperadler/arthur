# AR0372 - The stash refusal tells a job to write its patch to a fixed name in /tmp

```json
{
  "id": "AR0372",
  "title": "The stash refusal tells a job to write its patch to a fixed name in /tmp",
  "date": "2026-10-23"
}
```

## Description

the one place Arthur's code names a path in /tmp for anyone to write is a line a job is told to follow. `/tmp` is shared by every user of the host; a name a job picks (`<name>`) is one another job of the same user, told the same line, may pick too, so a stale or a foreign patch is what `git apply` reads. The worktree guard lets a write to `/tmp` pass by design (`worktree-guard.ts:11`). The test pins the refusal's prefix only (`packages/core/test/worktree-guard.test.ts:171`), not the path.

## Goal

The stash refusal points a job at a patch path inside its own record, not a fixed name in /tmp; tested.

- Kind: refactor

Evidence:
- `packages/core/src/worktree-guard.ts:29` (`save a patch instead (git diff > /tmp/<name>.patch, then git apply /tmp/<name>.patch)`)
- Found by: 2026-10-23-ar0327-security-check-56de526b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: name a path of the job's own in the refusal, `git diff > .arthur-stash.patch` in its worktree (which the guard passes and the job's `.gitignore` or a `git add` decides), or `$(mktemp)`; `packages/core/test/worktree-guard.test.ts:171` compares the whole refusal text for `git stash` and `git stash pop`, so a `/tmp` in it fails the test. Out: the guard's rule that a write to `/tmp` passes.
- `npm test` and `npm run check` pass.

## Scope

In:
- name a path of the job's own in the refusal, `git diff > .arthur-stash.patch` in its worktree (which the guard passes and the job's `.gitignore` or a `git add` decides), or `$(mktemp)`; `packages/core/test/worktree-guard.test.ts:171` compares the whole refusal text for `git stash` and `git stash pop`, so a `/tmp` in it fails the test. Out: the guard's rule that a write to `/tmp` passes.

## Decisions

- 2026-10-23: Source: F3 of AR0327
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
