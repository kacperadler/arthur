# AR0396 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A refspec that config or another repository defines still writes `refs/replace` past the guard

- Kind: security
- Found by: 2026-11-02-worker-a6b72b8b (worker), 2026-11-02
- Where: `packages/core/src/git-writes.ts` (`intoReplace` reads only the words of the call)
- What: the guard now refuses a fetch, pull, push or send-pack whose own words may write under `refs/replace`, but not one whose refspec comes from config or from another repository's refs. Run in a temporary repository (main checkout `m`, another repository `other` holding `refs/replace/<main's tip>`): `git -C other push --mirror ../m` wrote `refs/replace/<tip>` into `m`; the same arrives with no telling word by a remote whose config mirrors (`remote.<name>.mirror=true` in `other`'s config, or `git remote add --mirror=fetch` in the job's worktree, which writes the shared config) [INFERENCE: the config forms not run], or by a `HEAD` in `other` pointed at `refs/replace/<tip>` and `git -C other push ../m HEAD` [INFERENCE: not run].
- Suggestion: bound it where Git reads it rather than in the guard's words: either `core.useReplaceRefs=false` in each project's shared config (every worktree reads past any replacement; the ticket names it the owner's call, and `git-config.ts`'s allowed set would need the key), or `receive.hideRefs=refs/replace` there, which makes `receive-pack` refuse any push into `refs/replace` from anywhere (a fetch into the repository itself would still pass). Out: the guard's parsing.
- Status: open

## F2. `git fast-import` writes any ref, `refs/replace` and `refs/heads/main` included, and passes the guard

- Kind: security
- Found by: 2026-11-02-worker-a6b72b8b (worker), 2026-11-02
- Where: `packages/core/src/git-writes.ts:5` (`fast-import` is in neither list), `packages/core/src/bash-refusal.ts` (`git`: only `update-ref` looks at the ref)
- What: in a temporary repository with a job worktree `w` of main checkout `m`, `printf 'reset refs/replace/<tip>\nfrom <job commit>\n\n' | git -C w fast-import --quiet` made `git -C m replace -l` list main's tip and `git -C m status --short` show `M  f`. `gitCall(["fast-import", "--quiet"]).replaces` is `false`, and `fast-import` writes no checkout by `WRITES_CHECKOUT`, so the guard passes it; its commands come on stdin, which the guard does not read as refs. [INFERENCE: not run] a `reset refs/heads/main` the same way moves main, as `git update-ref refs/heads/main`, which the guard refuses.
- Suggestion: refuse `git fast-import` in a job as `git update-ref --stdin` is refused (the refs it writes are not in its words), with a row in `worktree-guard.test.ts`; a job that needs it imports into a repository of its own outside the shared one (`git -C /tmp/x fast-import`), which the refusal could allow by its folder.
- Status: open
