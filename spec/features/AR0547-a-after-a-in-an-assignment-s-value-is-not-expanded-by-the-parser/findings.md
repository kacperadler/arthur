# AR0547 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A `~-` after an assignment's `:` is not refused while OLDPWD is unknown

- Kind: security
- Found by: 2026-10-28-worker-1185a1c6 (worker), 2026-10-28
- Where: `packages/core/src/worktree-guard.ts:94`
- What: bash expands `~-` after an unquoted `:` of an assignment's value to `$OLDPWD` (`bash -c 'cd /tmp; cd /; x=a:~-/b; echo $x'` prints `a:/tmp/b`). Since AR0547 the parser keeps that `~-` raw, as after the `=`, but the guard refuses a `~-` while OLDPWD is unset or made unknown by a `local` only when it matches `(^|=)~-(\/|$)`, so `x=a:~-/b` is not refused there. [INFERENCE] from reading the line; the guard reads an assignment's value as one relative path, so no write through it was found.
- Suggestion: match `(^|[=:])~-([/:]|$)` in that check, with a refused row `f() { local OLDPWD; x=a:~-/b; }` in `worktree-guard.test.ts`; also name the `:` in the comment at `worktree-guard.ts:79`, which lists where a raw `~+` stands.
- Status: deferred (client summary)

## F2. A quoted name before `=` still counts as an assignment for `~`

- Kind: fix
- Found by: 2026-10-28-worker-1185a1c6 (worker), 2026-10-28
- Where: `packages/core/src/shell-words.ts:194`
- What: bash expands a `~` after `=` or `:` only when the word is an assignment as written; `bash -c 'echo "x"=~/b'` prints `x=~/b`. The parser tests the word with its quotes already removed, so `echo "x"=~/b` gives `x=<home>/b` and `echo "x"=~acme` is refused as "cannot tell". The parser reads more than bash does, so the guard refuses a call that is safe; nothing it misses was found.
- Suggestion: note at the word's start whether its name part was quoted, and expand only when it was not.
- Status: deferred (client summary)

## F3. `$OLDPWD` followed by anything but `/` passes the guard

- Kind: security
- Found by: 2026-10-28-worker-1185a1c6 (worker), 2026-10-28
- Where: `packages/core/src/shell-words.ts:101`, `packages/core/src/worktree-guard.ts:77` and `:94`
- What: the parser writes `$OLDPWD` and `${OLDPWD}` as a raw `~-` whatever follows, but the guard reads a raw `~-` as OLDPWD only before a `/` or the word's end. So `cd <main>/sub; cd <worktree>; echo x > $OLDPWD:x`, where bash writes `<main>/sub:x` in the main checkout, passes: a temporary row in `worktree-guard.test.ts` expecting a refusal failed with `undefined`. `${OLDPWD}.x` gives the raw word `~-.x` the same way. The parser line is not changed by this branch, so the base reads it the same way [INFERENCE: not run on the base].
- Suggestion: in the parser, give `$OLDPWD` followed by anything but `/`, a quote, a blank or the word's end the marker `\0-`, as an unknown `~name` gets. Or carry a raw `~-` into the guard unescaped, as `here` does for `~+`, so `located` can replace it before any character without reading a quoted `'~-'` as OLDPWD. Add refused rows for both spellings.
- Status: deferred (client summary)

## F4. A `~` right before a `:` is refused, where bash expands it

- Kind: ux
- Found by: 2026-10-28-worker-1185a1c6 (worker), 2026-10-28
- Where: `packages/core/src/shell-words.ts:194`
- What: bash ends a tilde prefix at a `:` too: `echo ~:/b` prints `<home>:/b`, and `x=a:~:~/c` gives `a:<home>:<home>/c`. The parser ends the name only at a `/`, so `~:` is read as the `~name` `:`, the "cannot tell" marker, and the guard refuses the call. The first round of AR0547 ended the name at a `:` too, but that let a raw `~-:x` past the guard, which reads a raw `~-` only before a `/` or the word's end (review 2026-10-28-review-6c536fee), so it was dropped.
- Suggestion: end a `~` name at a `:` only together with the guard reading a raw `~-` and `~+` before a `:` (F3), with refused rows for `~-:x`.
- Status: deferred (client summary)
