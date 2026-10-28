# AR0547 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A `~-` after an assignment's `:` is not refused while OLDPWD is unknown

- Kind: security
- Found by: 2026-10-28-worker-1185a1c6 (worker), 2026-10-28
- Where: `packages/core/src/worktree-guard.ts:94`
- What: bash expands `~-` after an unquoted `:` of an assignment's value to `$OLDPWD` (`bash -c 'cd /tmp; cd /; x=a:~-/b; echo $x'` prints `a:/tmp/b`). Since AR0547 the parser keeps that `~-` raw, as after the `=`, but the guard refuses a `~-` while OLDPWD is unset or made unknown by a `local` only when it matches `(^|=)~-(\/|$)`, so `x=a:~-/b` is not refused there. [INFERENCE] from reading the line; the guard reads an assignment's value as one relative path, so no write through it was found.
- Suggestion: match `(^|[=:])~-([/:]|$)` in that check, with a refused row `f() { local OLDPWD; x=a:~-/b; }` in `worktree-guard.test.ts`; also name the `:` in the comment at `worktree-guard.ts:79`, which lists where a raw `~+` stands.
- Status: open

## F2. A quoted name before `=` still counts as an assignment for `~`

- Kind: fix
- Found by: 2026-10-28-worker-1185a1c6 (worker), 2026-10-28
- Where: `packages/core/src/shell-words.ts:194`
- What: bash expands a `~` after `=` or `:` only when the word is an assignment as written; `bash -c 'echo "x"=~/b'` prints `x=~/b`. The parser tests the word with its quotes already removed, so `echo "x"=~/b` gives `x=<home>/b` and `echo "x"=~acme` is refused as "cannot tell". The parser reads more than bash does, so the guard refuses a call that is safe; nothing it misses was found.
- Suggestion: note at the word's start whether its name part was quoted, and expand only when it was not.
- Status: open
