# AR0524 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Bash builtins that set a variable without an assignment word still change git's config unseen

- Kind: security
- Found by: 2026-10-28-worker-bd3b91f9 (worker), 2026-10-28
- Where: `packages/core/src/worktree-guard.ts:101`
- What: the guard now counts `GIT_CONFIG*`, `HOME` and `XDG_CONFIG_HOME` set earlier in the call by an assignment, `export`, `declare`, `typeset`, `readonly` or `local`. Bash sets a variable in other ways too, and `HOME` is always exported, so the new value reaches git: `for HOME in /tmp/h; do git status; done` and `read HOME <<< /tmp/h; git status` both pass `worktreeRefusal` (each added for a moment to the AR0524 test's refused list, which then failed on it). `printf -v`, `mapfile`/`readarray`, `getopts` and `source` of a file that sets them are the same kind [INFERENCE: not run].
- Suggestion: count any of these that names `GIT_CONFIG*`, `HOME` or `XDG_CONFIG_HOME` as an operand (`for <name> in`, `read`, `printf -v`, `mapfile`, `readarray`, `getopts`) as set for every later git call; `source` and `.` stay out of reach (a file read at run time), as `GIT_DIR` exported before already is.
- Status: open
