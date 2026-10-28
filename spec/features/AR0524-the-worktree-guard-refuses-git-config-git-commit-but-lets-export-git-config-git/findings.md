# AR0524 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Bash builtins that set a variable without an assignment word still change git's config unseen

- Kind: security
- Found by: 2026-10-28-worker-bd3b91f9 (worker), 2026-10-28
- Where: `packages/core/src/worktree-guard.ts:101`
- What: the guard now counts `GIT_CONFIG*`, `HOME` and `XDG_CONFIG_HOME` set earlier in the call by an assignment, `export`, `declare`, `typeset`, `readonly` or `local`. Bash sets a variable in other ways too, and `HOME` is always exported, so the new value reaches git: `for HOME in /tmp/h; do git status; done` and `read HOME <<< /tmp/h; git status` both pass `worktreeRefusal` (each added for a moment to the AR0524 test's refused list, which then failed on it). `printf -v`, `mapfile`/`readarray`, `getopts` and `source` of a file that sets them are the same kind [INFERENCE: not run].
- Suggestion: count any of these that names `GIT_CONFIG*`, `HOME` or `XDG_CONFIG_HOME` as an operand (`for <name> in`, `read`, `printf -v`, `mapfile`, `readarray`, `getopts`) as set for every later git call; `source` and `.` stay out of reach (a file read at run time), as `GIT_DIR` exported before already is.
- Status: ticket AR0545

## F2. Other ways to set a variable still pass: let, a nameref, a default expansion and a name built at run time

- Kind: security
- Found by: 2026-10-28-review-b1141a21 (reviewer), 2026-10-28
- Where: `packages/core/src/worktree-guard.ts:101`
- What: each passes `worktreeRefusal`: `let HOME=5`, `declare -n r=HOME; r=/tmp/h`, `: ${GIT_CONFIG_COUNT:=1}; export GIT_CONFIG_COUNT`, `x=HOME; export $x=/tmp/h; git status` and `declare -x "$x=/tmp/h"`.
- Suggestion: the same as F1; a name that is not a literal word counts as unknown and refuses the later git call.
- Status: ticket AR0545

## F3. A function body or a trap is judged before a later export, and `function f { }` is not parsed

- Kind: security
- Found by: 2026-10-28-review-b1141a21 (reviewer), 2026-10-28
- Where: `packages/core/src/worktree-guard.ts:101,125`
- What: a function body is judged where it is defined, before the later `export` fills `configured`: `f() { git c a.c d; }; export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.c GIT_CONFIG_VALUE_0=config; f` and `cd() { git status; }; export HOME=/tmp/h; cd .` pass, and so does `trap "git status" EXIT; export HOME=/tmp/h`. The keyword form `function f { rm -rf <main>/x; }; f` is not parsed at all and passes.
- Suggestion: judge a function body and a trap's command with every assignment of the whole call counted, and parse the `function` keyword form as the `f()` form is.
- Status: ticket AR0546

## F4. Widening `XDG_CONFIG_HOME` to `XDG_CONFIG_HOME\w*` in `UNREAD` is not caught by a test

- Kind: test
- Found by: 2026-10-28-review-b1141a21 (reviewer), 2026-10-28
- Where: `packages/core/src/git-writes.ts`
- What: a mutation of the regex that the tests miss; the shape was there before the branch.
- Status: dropped (minor: a wider match only refuses more, and the shape predates the branch)
