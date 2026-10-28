# AR0496 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A known variable set by `for`, `read`, `printf -v`, a nameref or `eval $v=…` still passes the guard

- Kind: security
- Found by: 2026-10-28-worker-821d07d3 (worker), 2026-10-28
- Where: `packages/core/src/worktree-guard.ts:95`
- What: AR0496 refuses a call that sets HOME, ARTHUR_JOB or PWD by an assignment (before a command, alone, or by `export`, `declare`, `typeset`, `readonly`, `local`). It also refuses a name one of those builtins sets that holds a `$` or a backtick (`export $v=…`). Other builtins set these variables too, and the guard still reads the job's own values. Each of these passed the guard (as temporary pass rows in the table test of `packages/core/test/worktree-guard.test.ts`), and real bash deleted `../../acme/README.md` from a folder two levels below it: `for HOME in ../../acme; do rm $HOME/README.md; done`, `read HOME <<< ../../acme; rm $HOME/README.md`, `printf -v HOME ../../acme; rm $HOME/README.md`, `declare -n x=HOME; x=../../acme; bash -c 'rm $HOME/README.md'`. Review 2026-10-28-review-3a3446cb saw `v=HOME; eval $v=../../acme; rm ~/README.md` pass the guard. `eval` rereads its arguments once they are expanded, and by then the name is gone; this branch does not change the path `eval` takes. `mapfile`, `getopts` and `select` are untried. [INFERENCE] they behave the same.
- Suggestion: refuse a call where `for`/`select` loops over a known name, `read`, `mapfile`, `readarray` or `getopts` names one, `printf -v` targets one, or `declare -n`/`local -n`/`typeset -n` refers to one. All of these use the same unknown refusal. For `eval`: refuse an `eval` whose command is `dynamic` (shell-words.ts) and whose reread text holds a word starting with `=`. Unsetting a known variable (`unset HOME`) stays out: it empties the path and points it at `/`, not at a checkout.
- Status: open
