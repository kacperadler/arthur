# AR0383 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A link to the repository made and used in one bash call still moves main

- Kind: security
- Found by: 2026-10-25-ar0383-git-file-commondi-a61177b8 (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts` (`bashRefusal`'s `git`, which reads a folder's links from the files as they are when the call starts), `packages/core/src/git-link.ts`, `docs/deploy.md:34` (named as a limit)
- What: the guard now reads the links a git write's folders have before the call runs, so a `.git` file or `commondir` left by an earlier call (by any program, under any name) is refused, and writing a path named `.git` or `commondir` is refused. A link written and used in the same call is not: `printf 'gitdir: <root>/.git' > /tmp/l && git --git-dir=/tmp/l --work-tree=. commit -m x` passes the guard (a throwaway run of `worktreeRefusal` on it answered undefined), since `/tmp/l` is not named `.git` and does not exist when the call is judged; so does `node -e` writing `/tmp/z/.git` followed by `git -C /tmp/z commit` in one command.
- Suggestion: the real fix stays AR0376's sandbox (the repository's refs written only through Git run against the job's own worktree), with AR0361's merge check behind it. Short of it, the guard could refuse a git write whose `--git-dir`, `GIT_DIR` or folder is a path an earlier command of the same call writes (a redirect, `cp`, `mv`, `tee`), as it already tracks `cd`; a program's writes stay unseen either way.
- Status: open
