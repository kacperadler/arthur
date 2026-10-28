# AR0492 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A `~` after a `:` in an assignment's value is not expanded by the parser

- Kind: security
- Found by: 2026-10-28-worker-6a0ef2e0 (worker), 2026-10-28
- Where: `packages/core/src/shell-words.ts:194`
- What: bash expands a tilde prefix after each unquoted `:` of an assignment's value too, also in an assignment-like argument: `bash -c 'x=a:~root/y; echo $x; echo PATH=a:~/b'` prints `a:/root/y` and `PATH=a:/home/<user>/b`. The parser expands or refuses a `~` only at a word's start or right after the `=`, so `x=a:~/b` keeps `\~`. [INFERENCE] the guard reads an assignment's value as one path, which a `:`-joined list is not, so no write through it was found; a variable such a list feeds (`CDPATH=a:~acme` before a `cd`) could still lead elsewhere.
- Suggestion: treat a `~` after an unquoted `:` in an assignment-like word as at a word's start: `~` the home, `~name` and the other prefixes `\0-`.
- Status: ticket AR0547

## F2. Dropping `$` or the backtick from the `~name` class survives the tests

- Kind: test
- Found by: 2026-10-28-review-0ad6e27e (reviewer), 2026-10-28
- Where: `packages/core/src/shell-words.ts:193`
- What: either mutation only makes the guard refuse more (`~acme$x/...` refused where bash keeps a literal `~`); a passing row with `~acme$x/README.md` would pin it.
- Status: dropped (the mutation only refuses more; it never lets a write through)

## F3. A brace list such as `{x,~acme}` still reaches another user's home

- Kind: security
- Found by: 2026-10-28-review-0ad6e27e (reviewer), 2026-10-28
- Where: `packages/core/src/shell-words.ts`
- What: `rm {x,~acme}/README.md` parses as a literal word, while bash expands it to `/home/acme/README.md`; plain `{x,~}` was the same before this branch.
- Status: dropped (brace lists over several folders are the guard's documented limit, AR0320's check row 60)
