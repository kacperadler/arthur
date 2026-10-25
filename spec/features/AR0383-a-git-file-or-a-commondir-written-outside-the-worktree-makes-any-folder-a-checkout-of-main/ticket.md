# AR0383 - A `.git` file or a `commondir` written outside the worktree makes any folder a checkout of main

```json
{
  "id": "AR0383",
  "title": "A `.git` file or a `commondir` written outside the worktree makes any folder a checkout of main",
  "date": "2026-10-23"
}
```

## Description

in a temporary repository, `mkdir /tmp/z && cd /tmp/z && echo "gitdir: <root>/.git" > .git && git commit --allow-empty -m x` moved `main`; so did a folder `/tmp/g` holding `commondir` (`<root>/.git`), `HEAD` (`ref: refs/heads/main`) and empty `refs/`, `objects/`, used as `git --git-dir=/tmp/g --work-tree=. commit`. Every path those calls write is outside the guarded places, so the guard passes them; the commit lands on main as with the three routes this ticket closed.

## Goal

A `.git` file or a `commondir` a job writes outside its worktree can no longer turn a folder into a checkout of main; the guard refuses it; tested.

- Kind: security

Evidence:
- `packages/core/src/worktree-guard.ts:36-45` (`refusal` guards the worktree's own `.git` only), `:63-67` (named as a limit), `docs/deploy.md:34`
- Found by: 2026-10-23-ar0331-worktree-pointed-04fedd33 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: the real fix is the sandbox of AR0329 (a job's processes write only its worktree and `/tmp`, the repository's refs only through Git run against its own worktree); until then AR0361's merge check refuses a merge on top of such a commit. A guard rule (refuse writing any path named `.git` or `commondir`) closes the two literal forms only, and a program that writes still passes; out: anything short of the sandbox.
- `npm test` and `npm run check` pass.

## Scope

In:
- the real fix is the sandbox of AR0329 (a job's processes write only its worktree and `/tmp`, the repository's refs only through Git run against its own worktree); until then AR0361's merge check refuses a merge on top of such a commit. A guard rule (refuse writing any path named `.git` or `commondir`) closes the two literal forms only, and a program that writes still passes; out: anything short of the sandbox.

## Decisions

- 2026-10-23: Source: F1 of AR0331
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
- 2026-10-25: Coordinator (free hand on Arthur, the human 2026-10-23): kept the wider rule (git-link.ts reads gitfile and commondir links of a git write, since a gitfile of any name moved main in a probe); core budget 6021->6066.
