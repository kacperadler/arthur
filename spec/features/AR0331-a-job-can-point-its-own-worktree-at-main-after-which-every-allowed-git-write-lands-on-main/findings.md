# AR0331 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A `.git` file or a `commondir` written outside the worktree makes any folder a checkout of main

- Kind: risk
- Found by: 2026-10-23-ar0331-worktree-pointed-04fedd33 (worker), 2026-10-23
- Where: `packages/core/src/worktree-guard.ts:36-45` (`refusal` guards the worktree's own `.git` only), `:63-67` (named as a limit), `docs/deploy.md:34`
- What: in a temporary repository, `mkdir /tmp/z && cd /tmp/z && echo "gitdir: <root>/.git" > .git && git commit --allow-empty -m x` moved `main`; so did a folder `/tmp/g` holding `commondir` (`<root>/.git`), `HEAD` (`ref: refs/heads/main`) and empty `refs/`, `objects/`, used as `git --git-dir=/tmp/g --work-tree=. commit`. Every path those calls write is outside the guarded places, so the guard passes them; the commit lands on main as with the three routes this ticket closed.
- Suggestion: the real fix is the sandbox of AR0329 (a job's processes write only its worktree and `/tmp`, the repository's refs only through Git run against its own worktree); until then AR0361's merge check refuses a merge on top of such a commit. A guard rule (refuse writing any path named `.git` or `commondir`) closes the two literal forms only, and a program that writes still passes; out: anything short of the sandbox.
- Status: open

## F2. `git replace` from a job's worktree changes what every worktree reads of main's commits

- Kind: risk
- Found by: 2026-10-23-ar0331-worktree-pointed-04fedd33 (worker), 2026-10-23
- Where: `packages/core/src/git-writes.ts:4` (`replace` writes "the checkout it runs in", so from the job's worktree it passes), `packages/core/src/worktree-guard.ts:142-143` (only `update-ref` and a pointed checkout look at the ref)
- What: in a temporary repository, `git replace <main's tip> <a commit of the job>` run in the job's worktree made the main checkout read `main` as that commit: `git status` there showed `M  f` staged (its index no longer matches what HEAD now reads), and `git merge --no-ff <job branch>` there answered `refusing to merge unrelated histories`. `refs/replace/*` is shared by every worktree; Arthur's own git calls in the main checkout (`arthur merge`, `review-needed`, a board commit) read through it.
- Suggestion: in the guard's `git`, refuse `replace` other than `-l`/`--list` (and a bare `git replace`), as `update-ref` of a ref the job does not own is refused: `refusal(place, place.root, "git replace …")`; and run Arthur's git calls in a main checkout with `--no-replace-objects` (or `GIT_NO_REPLACE_OBJECTS=1`) beside the `-c` flags of AR0330. Tests: `worktree-guard.test.ts` rows for `git replace <a> <b>` and `git replace -d <a>` refused naming the main checkout, `git replace -l` passing; `merge.test.ts` a replace ref on main's tip does not change what the merge builds on.
- Status: open
