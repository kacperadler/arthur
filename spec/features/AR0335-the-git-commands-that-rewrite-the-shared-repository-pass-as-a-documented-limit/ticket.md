# AR0335 - The git commands that rewrite the shared repository pass as a documented limit

```json
{
  "id": "AR0335",
  "title": "The git commands that rewrite the shared repository pass as a documented limit",
  "date": "2026-10-23"
}
```

## Description

`git gc --prune=now`, `git reflog expire --expire=now --all`, `git -C <main> gc`, `git -C <main> worktree prune` and `git worktree add /tmp/x -b h/x` pass the guard; they rewrite `<root>/.git`, which every worktree and the main checkout share: unreachable objects of another job's reset, a stash entry's reflog, a worktree's metadata, a new branch.

## Goal

The git commands that rewrite the shared repository (`gc`, `reflog expire`, `worktree prune`, `worktree add` outside the worktrees) are refused for a job, not left as a documented limit; tested.

- Kind: security

Evidence:
- `packages/core/src/git-writes.ts:4` (none of `gc`, `prune`, `repack`, `reflog`, `maintenance`, `worktree prune`, `worktree add` outside the worktrees folder), `packages/core/src/worktree-guard.ts:59`, `docs/deploy.md:34`
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: `gc`, `prune`, `repack`, `reflog` (any but `show`), `maintenance`, `filter-repo`, `worktree prune` and `worktree add` with a target outside the worktrees folder are a write of the main checkout wherever they run: `refusal(place, place.root, "git <sub>")`. Tests: each refused naming the main checkout; `git reflog show` and `git worktree list` passing.
- `npm test` and `npm run check` pass.

## Scope

In:
- `gc`, `prune`, `repack`, `reflog` (any but `show`), `maintenance`, `filter-repo`, `worktree prune` and `worktree add` with a target outside the worktrees folder are a write of the main checkout wherever they run: `refusal(place, place.root, "git <sub>")`. Tests: each refused naming the main checkout; `git reflog show` and `git worktree list` passing.

## Decisions

- 2026-10-23: Source: F7 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-26: AR0335 another round: the worker fixes the worktree add target after -- that starts with -, adds its test row, then review round 3; the owner: "AR-D49 - 1" (AR-D49)
- 2026-10-26: AR0335 another round: the worker treats --end-of-options like -- for worktree add/move targets, adds that row and an inside-target add from an outside folder, then review round 4; the owner: "AR-D51 - 1" (AR-D51)
- 2026-10-26: Raise the core line budget from 6197 to 6206 for AR0335; the owner: "AR-D54 - 1" (AR-D54)
