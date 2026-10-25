# AR0384 - `git replace` from a job's worktree changes what every worktree reads of main's commits

```json
{
  "id": "AR0384",
  "title": "`git replace` from a job's worktree changes what every worktree reads of main's commits",
  "date": "2026-10-23"
}
```

## Description

in a temporary repository, `git replace <main's tip> <a commit of the job>` run in the job's worktree made the main checkout read `main` as that commit: `git status` there showed `M  f` staged (its index no longer matches what HEAD now reads), and `git merge --no-ff <job branch>` there answered `refusing to merge unrelated histories`. `refs/replace/*` is shared by every worktree; Arthur's own git calls in the main checkout (`arthur merge`, `review-needed`, a board commit) read through it.

## Goal

`git replace` from a job's worktree is refused, so a job cannot change what every worktree reads of main's commits; tested.

- Kind: security

Evidence:
- `packages/core/src/git-writes.ts:4` (`replace` writes "the checkout it runs in", so from the job's worktree it passes), `packages/core/src/worktree-guard.ts:142-143` (only `update-ref` and a pointed checkout look at the ref)
- Found by: 2026-10-23-ar0331-worktree-pointed-04fedd33 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in the guard's `git`, refuse `replace` other than `-l`/`--list` (and a bare `git replace`), as `update-ref` of a ref the job does not own is refused: `refusal(place, place.root, "git replace …")`; and run Arthur's git calls in a main checkout with `--no-replace-objects` (or `GIT_NO_REPLACE_OBJECTS=1`) beside the `-c` flags of AR0330. Tests: `worktree-guard.test.ts` rows for `git replace <a> <b>` and `git replace -d <a>` refused naming the main checkout, `git replace -l` passing; `merge.test.ts` a replace ref on main's tip does not change what the merge builds on.
- `npm test` and `npm run check` pass.

## Scope

In:
- in the guard's `git`, refuse `replace` other than `-l`/`--list` (and a bare `git replace`), as `update-ref` of a ref the job does not own is refused: `refusal(place, place.root, "git replace …")`; and run Arthur's git calls in a main checkout with `--no-replace-objects` (or `GIT_NO_REPLACE_OBJECTS=1`) beside the `-c` flags of AR0330. Tests: `worktree-guard.test.ts` rows for `git replace <a> <b>` and `git replace -d <a>` refused naming the main checkout, `git replace -l` passing; `merge.test.ts` a replace ref on main's tip does not change what the merge builds on.

## Decisions

- 2026-10-23: Source: F2 of AR0331
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
- 2026-10-25: Coordinator (free hand on Arthur, the human 2026-10-23): core line budget 6066->6071 for the replace detection in git-writes.ts.
