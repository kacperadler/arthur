# AR0400 - `arthur prune` of a job here runs a clean filter the main checkout's config or the job worktree's own names

```json
{
  "id": "AR0400",
  "title": "`arthur prune` of a job here runs a clean filter the main checkout's config or the job worktree's own names",
  "date": "2026-10-25"
}
```

## Description

the prune of a job on `local` runs `git worktree remove <worktree>` (hooks and fsmonitor off) with no `configRefusal` first. `git worktree remove` runs `git status` in the worktree, which runs `filter.<driver>.clean` from the repository's shared `.git/config` or the worktree's own `config.worktree` on a file whose stat is stale and whose `.gitattributes` names that driver; a job's program can write both. Reproduced with Git 2.43 on a bare repository (the same call AR0394 now refuses on another machine): the filter ran once from the shared config and once from a worktree's `config.worktree` (`git -C <repo> -c core.hooksPath=/dev/null -c core.fsmonitor=false worktree remove <wt>`), and not with `--force`.

## Goal

`arthur prune` of a job on this machine runs no program the main checkout's or the worktree's config names, as AR0394 does for a prune on another machine.

- Kind: security

## Done means

- The fix, with a test that proves it: as `arthur remote-job prune` does since AR0394, keep the worktree, branch and record when `configRefusal(<worktree>)` is not empty while the worktree exists (`kept its worktree, branch and record: git worktree: <file> sets <key>, …`), with a test in the prune tests; `removeWorktree` (`--force`) runs no `git status` and stays as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- as `arthur remote-job prune` does since AR0394, keep the worktree, branch and record when `configRefusal(<worktree>)` is not empty while the worktree exists (`kept its worktree, branch and record: git worktree: <file> sets <key>, …`), with a test in the prune tests; `removeWorktree` (`--force`) runs no `git status` and stays as it is.

## Decisions

- 2026-10-25: Source: F1 of AR0394
