# AR0615 - A job may write under refs/replace through a refspec from config or another repository: close it in Git config

```json
{
  "id": "AR0615",
  "title": "A job may write under refs/replace through a refspec from config or another repository: close it in Git config",
  "date": "2026-11-03"
}
```

## Description

AR0396 made the worktree guard refuse a `git fetch`, `pull`, `push` or `send-pack` whose own words may write under `refs/replace`. A refspec that comes from config (a remote's `fetch`, `push` or `mirror`, by `-c` too), from another repository's refs, or from a variable built at run time still writes a replacement there, which every worktree of the project then reads. This closes it where Git reads it, not in the guard's words, by the Git setting the owner picks.

## Goal

Finding F1 of AR0396 (`npx arthur findings AR0396`), confirmed by its review as F4: run in a temporary repository, `git -C other push --mirror ../m` wrote `refs/replace/<tip>` into the main checkout `m`; a remote with `remote.<name>.mirror=true` does the same with no word the guard reads. The limit is named in `packages/core/src/git-writes.ts:100-104` and `docs/deploy.md:42`.

The two ways the finding names:
- `core.useReplaceRefs=false` in each project's shared config: every worktree reads past any replacement, whoever wrote it; `packages/core/src/git-config.ts`'s `ALLOWED` set needs the key.
- `receive.hideRefs=refs/replace` there: `receive-pack` refuses any push into `refs/replace` from anywhere; a fetch into the repository itself still passes.

The owner picks one (the decision is recorded under Decisions) before the worker starts.

- Kind: security

## Done means

- The setting the owner picked is in force for every project's shared config Arthur's jobs use, set where Arthur sets its other shared Git config, and kept there.
- A test in a temporary repository: the mirror push of the finding (`git -C other push --mirror ../m` with `other` holding `refs/replace/<tip>`) no longer changes what `git -C m status` or `git -C m log -1` reads; it fails before the change and passes after.
- `docs/deploy.md:42` and the comment at `packages/core/src/git-writes.ts:100-104` name the setting instead of the open limit.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/git-config.ts`: the key in `ALLOWED` if the pick needs it, and where the shared config is set.
- `packages/core/test/`: the test above.
- `docs/deploy.md`, `packages/core/src/git-writes.ts` (comment only).

Out:
- The guard's own parsing of refspecs (AR0396 did it).
- `git fast-import` (AR0616) and brace lists in paths (AR0617).

## Decisions

