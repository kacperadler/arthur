# AR0332 - `GIT_DIR=`, `GIT_WORK_TREE=`, `GIT_INDEX_FILE=` before `git` are not read as `--git-dir`, `--work-tree`

```json
{
  "id": "AR0332",
  "title": "`GIT_DIR=`, `GIT_WORK_TREE=`, `GIT_INDEX_FILE=` before `git` are not read as `--git-dir`, `--work-tree`",
  "date": "2026-10-23"
}
```

## Description

`git --work-tree=<main> checkout -- .` is refused, but `GIT_WORK_TREE=<main> git checkout -- .`, `GIT_DIR=<main>/.git GIT_WORK_TREE=<main> git reset --hard`, `env GIT_WORK_TREE=<main> git checkout -- .` and `GIT_INDEX_FILE=<root>/.git/index git add .` pass; git reads the variables as it reads the options (git(1), "Environment variables"), and the first, run in a temporary repository, rewrote the main checkout's `README.md`.

## Goal

`GIT_DIR=`, `GIT_WORK_TREE=`, `GIT_INDEX_FILE=` before `git` (or through `env`) are judged as `--git-dir`/`--work-tree`, so they cannot reach main's checkout; tested.

- Kind: fix

Evidence:
- `packages/core/src/worktree-guard.ts:45-51` (`commandIndex` skips `NAME=value` words and the options of `env`), `packages/core/src/git-writes.ts:6` (`VALUE_OPTIONS` names the options only)
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: `commandIndex` returns the assignment words it skipped (and the `NAME=value` arguments of `env`); the guard's `git` adds the values of `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY` and `GIT_COMMON_DIR` to `trees`. Tests: the four forms refused naming the main checkout; `GIT_AUTHOR_NAME=x git commit -m y` passing.
- `npm test` and `npm run check` pass.

## Scope

In:
- `commandIndex` returns the assignment words it skipped (and the `NAME=value` arguments of `env`); the guard's `git` adds the values of `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY` and `GIT_COMMON_DIR` to `trees`. Tests: the four forms refused naming the main checkout; `GIT_AUTHOR_NAME=x git commit -m y` passing.

## Decisions

- 2026-10-23: Source: F4 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
