# AR0616 - git fast-import in a job writes any ref, main included, past the worktree guard

```json
{
  "id": "AR0616",
  "title": "git fast-import in a job writes any ref, main included, past the worktree guard",
  "date": "2026-11-03"
}
```

## Description

A job can run `git fast-import`, whose commands come on stdin, and so write any ref of the project's shared repository, `refs/heads/main` and `refs/replace` included, past the worktree guard. The guard already refuses `git update-ref --stdin` for the same reason; this refuses `fast-import` the same way.

## Goal

Finding F2 of AR0396 (`npx arthur findings AR0396`), confirmed by its review as F5: in a temporary repository with a job worktree `w` of main checkout `m`, `printf 'reset refs/replace/<tip>\nfrom <job commit>\n\n' | git -C w fast-import --quiet` made `git -C m replace -l` list main's tip and `git -C m status --short` show a change. `fast-import` is in no list of `packages/core/src/git-writes.ts` (line 5), and `packages/core/src/bash-refusal.ts` looks at the ref only for `update-ref`.

- Kind: security

## Done means

- In a job, `git fast-import` run on the shared repository (from the job's worktree, by `-C`, or by `--git-dir`) is refused with a reason that says its refs come on stdin, as `git update-ref --stdin` is.
- `git -C <a folder outside every project> fast-import` still runs, so a job that needs it imports into a repository of its own.
- Rows in `packages/core/test/worktree-guard.test.ts` for each: they fail when the refusal is removed.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/git-writes.ts`: `fast-import` among the commands whose refs are not in their words.
- `packages/core/src/bash-refusal.ts`: the refusal, if it is not already reached through the list.
- `packages/core/test/worktree-guard.test.ts`: the rows above.

Out:
- Refspecs from config (AR0615) and brace lists in paths (AR0617).

## Decisions

