# AR0361 - A merge takes main as it is: a commit that reached main by another route is merged on and pushed with the next merge

```json
{
  "id": "AR0361",
  "title": "A merge takes main as it is: a commit that reached main by another route is merged on and pushed with the next merge",
  "date": "2026-10-23"
}
```

## Description

when a commit lands on main other than through `arthur merge` (AR0320 F3 / AR0331: a job's worktree pointed at main, then a plain `git commit` there; or a hand edit in the main checkout), nothing notices: the next merge builds on it, its checks run with it, and `github.push` sends it to origin as part of main. The guard fix is AR0331's; this is the second line AR0320 F3 named for this area.

## Goal

A merge refuses when main moved by any route but `arthur merge`, so a stray commit is never merged on and pushed; tested.

- Kind: security

Evidence:
- `packages/delivery/src/merge-command.ts:78` (`before` is HEAD, whatever it is), `:41-44` and `packages/github/src/github-git.ts:31-36` (main pushed, fast-forward, after the merge)
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: before the merge, list the non-merge first-parent commits of main since its last merge commit (`git rev-list -1 --merges --first-parent HEAD`) that change a file outside `spec/**`, `CHANGELOG.md` and `*.md`: `git log --first-parent --no-merges --format=%h <last merge>..HEAD -- . ':(exclude)spec' ':(exclude)CHANGELOG.md' ':(exclude)*.md'`; any such commit refuses: `main has <n> commits since its last merge that change code (<shas>); only a merge puts code on main; the owner decides: main is unchanged`. The owner's own hand commits of code on main are refused by this too, by design (code goes through a ticket); a repository with no merge yet lists from the root. Tests in `merge.test.ts`: a code commit on main between two merges refuses the second naming it; a commit of `spec/` and `CHANGELOG.md` does not; `--unreviewed` does not lift it.
- `npm test` and `npm run check` pass.

## Scope

In:
- before the merge, list the non-merge first-parent commits of main since its last merge commit (`git rev-list -1 --merges --first-parent HEAD`) that change a file outside `spec/**`, `CHANGELOG.md` and `*.md`: `git log --first-parent --no-merges --format=%h <last merge>..HEAD -- . ':(exclude)spec' ':(exclude)CHANGELOG.md' ':(exclude)*.md'`; any such commit refuses: `main has <n> commits since its last merge that change code (<shas>); only a merge puts code on main; the owner decides: main is unchanged`. The owner's own hand commits of code on main are refused by this too, by design (code goes through a ticket); a repository with no merge yet lists from the root. Tests in `merge.test.ts`: a code commit on main between two merges refuses the second naming it; a commit of `spec/` and `CHANGELOG.md` does not; `--unreviewed` does not lift it.

## Decisions

- 2026-10-23: Source: F5 of AR0324
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
