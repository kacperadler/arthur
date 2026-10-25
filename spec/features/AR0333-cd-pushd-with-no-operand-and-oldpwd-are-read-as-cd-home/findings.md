# AR0333 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `cd $PWD` and `cd ~+` are read as `cd $HOME` or a folder named `~+`

- Kind: security
- Found by: 2026-10-25-worker-9a6298d8 (worker), 2026-10-25
- Where: `packages/core/src/shell-words.ts:104`, `packages/core/src/worktree-guard.ts:108`
- What: `shellCommands("cd $PWD; cd ~+; cd \"$PWD\"", "/h")` gives the words `["cd"]`, `["cd","~+"]`, `["cd"]` (seen with `node -e`): `$PWD` expands to nothing, so the guard moves to `$HOME` while bash stays. A bash call with `cwd` the main checkout and `cd $PWD; rm README.md` is judged in the home folder, so it passes [INFERENCE: from the parsed words and `bashRefusal`'s `cd` branch; not run].
- Suggestion: read `$PWD` as `~+` in shell-words.ts, as this ticket reads `$OLDPWD` as `~-`, and have `located` in the guard take `~+` as `cwd`. Out: other variables.
- Status: open

## F2. An `OLDPWD` set by `read`, `printf -v`, `mapfile` or a nameref is not seen

- Kind: security
- Found by: 2026-10-25-worker-9a6298d8 (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:99-100`
- What: the guard follows OLDPWD through a plain assignment, `export`/`declare`/`typeset`/`readonly`/`local`, `unset` and each `cd`/`pushd`/`popd`. `read OLDPWD <<< <main>; cd -; rm README.md` sets it unseen, so `cd -` is read as the folder before [INFERENCE: from the code; not run]. Also, a quoted `'~-'` is read as OLDPWD's folder though bash takes it as a folder named `~-` (shell-words.ts gives `~-` for both).
- Suggestion: treat a command that names `OLDPWD` as an operand of `read`, `printf -v`, `mapfile`/`readarray` or `declare -n` as making OLDPWD unknown (`previous = undefined`, which refuses a later `~-`/`$OLDPWD`), or refuse it outright.
- Status: open
