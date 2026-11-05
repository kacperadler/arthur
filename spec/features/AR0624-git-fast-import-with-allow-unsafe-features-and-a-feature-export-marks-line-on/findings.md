# AR0624 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. git fast-import appends to any file named by a stdin `option git export-pack-edges=` line, without --allow-unsafe-features

- Kind: security
- Found by: 2026-11-05-worker-e5e58c0b (worker), 2026-11-05
- Where: `packages/core/src/bash-refusal.ts:131`
- What: Git 2.43 takes `option git export-pack-edges=<path>` from fast-import's stdin with no `--allow-unsafe-features` and opens that file for append. Seen with `printf 'option git export-pack-edges=%s/edges\n' $d | git -C $d/r fast-import --quiet`, which created `$d/edges`; the same stdin with `feature export-marks=` was refused by Git. The worktree guard lets `git -C /tmp/other fast-import` run (a repository outside every project), so such a line can name a file in the main checkout. The command line's `--export-pack-edges=` is judged as an operand already.
- Suggestion: refuse `git fast-import` whose stdin the guard cannot read on every repository, or judge a literal stdin (`printf …|`, a heredoc) for `option git export-pack-edges=` paths; Git programs called by their path stay with AR0625.
- Status: open
