# AR0331 - A job can point its own worktree at `main`, after which every allowed git write lands on main

```json
{
  "id": "AR0331",
  "title": "A job can point its own worktree at `main`, after which every allowed git write lands on main",
  "date": "2026-10-23"
}
```

## Description

three calls pass the guard from the job's worktree: `git switch --ignore-other-worktrees main` (or `git checkout --ignore-other-worktrees main`), `git symbolic-ref HEAD refs/heads/main`, and a write of the worktree's `.git` file with `gitdir: <root>/.git`. After each, run in a temporary repository, a plain `git commit` in the worktree moved `main`, and the main checkout's index no longer matched its tree. Git itself refuses `git branch -f main`, `git push . HEAD:refs/heads/main` and `git fetch . HEAD:refs/heads/main` for a branch checked out elsewhere, so those need no check of ours; `git tag -f` it allows (a tag is no ref Arthur merges from).

## Goal

A job cannot point its worktree at `main` (`switch --ignore-other-worktrees`, `symbolic-ref HEAD`, a rewritten `.git` file); main moves only through `arthur merge`; tested.

- Kind: risk

Evidence:
- `packages/core/src/git-writes.ts:4` (`switch`, `checkout`, `symbolic-ref` write "the checkout they run in"), `packages/core/src/worktree-guard.ts:135` (that checkout is the worktree, so it passes), `:134` (only `update-ref` looks at the ref), `:156` (the worktree's own `.git` file is inside the worktree)
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in the guard's `git`: refuse `--ignore-other-worktrees` on `switch` and `checkout`; refuse `symbolic-ref HEAD <ref>` when `<ref>` is not `refs/heads/<place.branch>` (as `update-ref` is handled at `:134`); and in `refusal`, treat `<worktree>/.git` (a file, the worktree's link to the repository) as the main checkout for `edit`, `write` and any bash write. Tests in `worktree-guard.test.ts`: each of the four refused naming the main checkout; `git switch -c topic`, `git checkout -- .`, `git symbolic-ref HEAD refs/heads/<own branch>` passing. Defence in depth, AR0324: before a merge, refuse when `main`'s tip is not the commit Arthur last left there.
- `npm test` and `npm run check` pass.

## Scope

In:
- in the guard's `git`: refuse `--ignore-other-worktrees` on `switch` and `checkout`; refuse `symbolic-ref HEAD <ref>` when `<ref>` is not `refs/heads/<place.branch>` (as `update-ref` is handled at `:134`); and in `refusal`, treat `<worktree>/.git` (a file, the worktree's link to the repository) as the main checkout for `edit`, `write` and any bash write. Tests in `worktree-guard.test.ts`: each of the four refused naming the main checkout; `git switch -c topic`, `git checkout -- .`, `git symbolic-ref HEAD refs/heads/<own branch>` passing. Defence in depth, AR0324: before a merge, refuse when `main`'s tip is not the commit Arthur last left there.

## Decisions

- 2026-10-23: Source: F3 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
