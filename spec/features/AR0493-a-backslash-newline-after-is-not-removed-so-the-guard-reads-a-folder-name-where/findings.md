# AR0493 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `$'…'` drops the backslash of an escape bash keeps

- Kind: security
- Found by: 2026-10-28-worker-7b31d67c (worker), 2026-10-28
- Where: `packages/core/src/shell-words.ts:26-34` (`decodeEscapes`)
- What: `decodeEscapes` reads any escape it does not know as the character alone ("any other escaped character stands for itself"), but bash 5.2.21 keeps the backslash: `printf '[%s]' $'\q\.\?\"'` prints `[\q\.?"]` (checked with `env -i bash`). So the guard reads another name than bash does. For `\<newline>` that was a one-call deletion (`bash -c $'rm \<newline>$HOME/acme/README.md'`, review 4); this branch now refuses any backslash-newline in `$'…'` as unknown, with rows for it. What stays: another unknown escape (`$'x\q'`) names a file bash reads as `x\q` and the guard as `xq`. A link made in one call under bash's name and used in a later call through `$'…'` is then not found by `real()` under the guard's name, so a write through it passes while bash follows the link. Inference from the code, not run through the guard.
- Suggestion: in `decodeEscapes`, keep the backslash for an escape outside bash's list (`\\`, `\'`, `\"`, `\?` and the letters, digits and `x`/`u`/`U`/`c` forms), with guard rows for `$'\.\.'` and `$'x\q'`; reading it as bash does refuses more, never less.
- Status: open
