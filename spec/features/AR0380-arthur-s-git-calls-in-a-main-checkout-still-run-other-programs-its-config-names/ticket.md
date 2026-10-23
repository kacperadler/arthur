# AR0380 - Arthur's git calls in a main checkout still run other programs its config names

```json
{
  "id": "AR0380",
  "title": "Arthur's git calls in a main checkout still run other programs its config names",
  "date": "2026-10-23"
}
```

## Description

the flags of this ticket turn off hooks and `core.fsmonitor` only. A program a job runs (`node -e`, which the worktree guard does not see) can still write the shared `.git/config` with `core.sshCommand` (run by `github.push` to an SSH origin; `gitOver` sets `GIT_SSH_COMMAND`, which wins), a `filter.<name>.clean`/`smudge` driver that a `.gitattributes` on the job's branch names (run by `arthur merge`'s merge and by a worktree's checkout), `gpg.program` with `commit.gpgSign` (run by the merge commit), or `credential.helper` (run by a push over HTTPS); each runs as Arthur, outside the job's scope.

## Goal

Arthur's own git calls in a main checkout run no program the repository's config names (filters, diff and merge drivers, credential helpers beyond the user's), so a job cannot plant one; tested.

- Kind: risk

Evidence:
- `packages/delivery/src/merge-command.ts:58`, `packages/github/src/github-git.ts:38`, `packages/core/src/git.ts:9`
- Found by: 2026-10-23-ar0330-git-config-eb39f9d4 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: decide whether Arthur's main-checkout git calls should read the shared config at all: either pass each of these keys as `-c` too, or check `git config --local --list` against an allowed set before `arthur merge` and a push and refuse with the key named.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide whether Arthur's main-checkout git calls should read the shared config at all: either pass each of these keys as `-c` too, or check `git config --local --list` against an allowed set before `arthur merge` and a push and refuse with the key named.

## Decisions

- 2026-10-23: Source: F2 of AR0330
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
