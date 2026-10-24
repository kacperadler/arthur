# AR0381 - The worktree guard does not see a git alias or GIT_DIR

```json
{
  "id": "AR0381",
  "title": "The worktree guard does not see a git alias or GIT_DIR",
  "date": "2026-10-23"
}
```

## Description

probed with git 2.43 in a temporary repository and worktree: `git -c alias.c=config c a.c d` run in the worktree wrote `c = d` into the main checkout's `.git/config`; `GIT_DIR=<main>/.git git config --worktree a.c c` wrote the main checkout's own `config.worktree`. The guard takes `c` as the subcommand and the job's worktree as the place, so both pass. A job may also set `alias.c = config` with `git config --worktree`, which passes, and run `git c …` later. Named as a limit in `docs/deploy.md` and the guard's comment.

## Goal

The worktree guard also refuses a write reached through a git alias or GIT_DIR/GIT_WORK_TREE pointing outside the job's checkout; tested.

- Kind: security

Evidence:
- `packages/core/src/git-writes.ts:28` (`gitCall`), `packages/core/src/worktree-guard.ts:131` (`git`)
- Found by: 2026-10-23-ar0330-git-config-eb39f9d4 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in `gitCall`, resolve a `-c alias.<sub>=<value>` given on the same line; refuse a `--worktree` or `--file` write of an `alias.*` or `include*` key; take `GIT_DIR=`/`GIT_WORK_TREE=` assignments before `git` as `trees`. An `export GIT_DIR` in an earlier command, or an alias in `~/.gitconfig` the user already had, stays out of sight.
- `npm test` and `npm run check` pass.

## Scope

In:
- in `gitCall`, resolve a `-c alias.<sub>=<value>` given on the same line; refuse a `--worktree` or `--file` write of an `alias.*` or `include*` key; take `GIT_DIR=`/`GIT_WORK_TREE=` assignments before `git` as `trees`. An `export GIT_DIR` in an earlier command, or an alias in `~/.gitconfig` the user already had, stays out of sight.

## Decisions

- 2026-10-23: Source: F3 of AR0330
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
- 2026-10-25: Coordinator (free hand on Arthur, the human 2026-10-23): core line budget 5987->6017; git calls whose config the guard cannot read (GIT_CONFIG_GLOBAL=, HOME=, shell aliases, include) stay refused, harmless ones included: safer over convenient.
