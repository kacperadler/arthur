# AR0416 - A `~` after the `=` of an assignment before git is not expanded, so `GIT_WORK_TREE=~/<main>` passes the guard

```json
{
  "id": "AR0416",
  "title": "A `~` after the `=` of an assignment before git is not expanded, so `GIT_WORK_TREE=~/<main>` passes the guard",
  "date": "2026-10-25"
}
```

## Description

F2 of AR0332 (spec/features/AR0332-git-dir-git-work-tree-git-index-file-before-git-are-not-read-as-git-dir-work-tree/findings.md): the worktree guard expands `~` only at the start of a word, while bash also expands it after the `=` of an assignment word and of `env NAME=value`; so `GIT_WORK_TREE=~/acme git checkout -- .` writes into a main checkout under the home folder.

## Goal

The guard reads `~` after `=` in an assignment as bash does, so `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY` and `GIT_COMMON_DIR` set to `~/<main>` are refused as `$HOME/<main>` already is. Evidence: `packages/core/src/shell-words.ts:194`; review 2026-10-25-review-79c6358f ran `GIT_WORK_TREE=~/acme git checkout -- .` with `HOME` a temporary folder: it reset main's changed `README.md`; the same call with `$HOME/acme` is refused.

- Kind: security

## Done means

- `GIT_WORK_TREE=~/<main> git checkout -- .`, `GIT_INDEX_FILE=~/<main>/.git/index git add .` and `env GIT_INDEX_FILE=~/<main>/.git/index git add .` are refused naming the main checkout, in `packages/core/test/worktree-guard.test.ts`; the core's line budget holds; the project's checks pass.

## Scope

In:
- `packages/core/src/shell-words.ts`: `~` after the `=` of an assignment word (and of `env`'s `NAME=value`) expands to the home folder.
- `packages/core/test/worktree-guard.test.ts`: the rows.

Out:
- `env -C` and `sudo -D` (AR0415).

## Decisions

- 2026-10-25: Source: F2 of AR0332
- 2026-10-25: AR0416 approved under the owner's standing word (AR-D31); the owner: "always go with recommendation till the 8 am morning" (AR-D34)
