# AR0395 - A link to the repository made and used in one bash call still moves main

```json
{
  "id": "AR0395",
  "title": "A link to the repository made and used in one bash call still moves main",
  "date": "2026-10-25"
}
```

## Description

the guard now reads the links a git write's folders have before the call runs, so a `.git` file or `commondir` left by an earlier call (by any program, under any name) is refused, and writing a path named `.git` or `commondir` is refused. A link written and used in the same call is not: `printf 'gitdir: <root>/.git' > /tmp/l && git --git-dir=/tmp/l --work-tree=. commit -m x` passes the guard (a throwaway run of `worktreeRefusal` on it answered undefined), since `/tmp/l` is not named `.git` and does not exist when the call is judged; so does `node -e` writing `/tmp/z/.git` followed by `git -C /tmp/z commit` in one command.

## Goal

A link to the repository a job makes and uses in one bash call cannot move main; the real bound is the OS sandbox of AR0376, so this ticket waits on its outcome.

- Kind: security

## Done means

- The fix, with a test that proves it: the real fix stays AR0376's sandbox (the repository's refs written only through Git run against the job's own worktree), with AR0361's merge check behind it. Short of it, the guard could refuse a git write whose `--git-dir`, `GIT_DIR` or folder is a path an earlier command of the same call writes (a redirect, `cp`, `mv`, `tee`), as it already tracks `cd`; a program's writes stay unseen either way.
- `npm test` and `npm run check` pass.

## Scope

In:
- the real fix stays AR0376's sandbox (the repository's refs written only through Git run against the job's own worktree), with AR0361's merge check behind it. Short of it, the guard could refuse a git write whose `--git-dir`, `GIT_DIR` or folder is a path an earlier command of the same call writes (a redirect, `cp`, `mv`, `tee`), as it already tracks `cd`; a program's writes stay unseen either way.

## Decisions

- 2026-10-25: Source: F1 of AR0383
