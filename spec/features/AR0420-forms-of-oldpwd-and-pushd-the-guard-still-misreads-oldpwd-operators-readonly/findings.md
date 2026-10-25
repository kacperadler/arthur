# AR0420 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A function's `local OLDPWD=` is no longer followed where the guard reads its body

- Kind: security
- Found by: 2026-10-25-worker-3e326757 (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:101`
- What: the guard reads a function's body where it is defined, not where it is called. Before this ticket `local` counted as an assignment there, so `f() { local OLDPWD=<main>; cd -; rm README.md; }; f` was refused by chance. Now `local` is dropped, as bash refuses it outside a function, and that command passes [INFERENCE: from the lines, not run]. The ticket's Scope leaves functions to a later ticket.
- Suggestion: the functions ticket follows a body at its call, with `local` and `declare` scoped to it; until then, refusing `local OLDPWD` inside `{ … }` as unknown would be enough.
- Status: fixed in d1914e85

## F2. `declare -n OLDPWD=name` and `pushd -n -` are not followed

- Kind: security
- Found by: 2026-10-25-worker-3e326757 (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:101`, `:111`
- What: with real bash, `cd /tmp; cd /var; declare -n OLDPWD=HOME; cd -` goes to `$HOME`; the guard reads it as `OLDPWD=HOME`, a relative path. `pushd -n -` puts the literal `-` on the stack, and a later `popd` goes to OLDPWD as it is then; the guard puts `<cwd>/-` there. Both were seen with `env -u OLDPWD bash -c …`.
- Suggestion: refuse `declare`/`typeset -n` naming OLDPWD as unknown, and keep `-` on the guard's stack as `-`, resolved at the `popd`.
- Status: open
