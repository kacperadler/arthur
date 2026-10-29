# AR0546 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A function's body or a trap's command is judged in the folder where it is defined, not where it runs

- Kind: security
- Found by: 2026-10-29-worker-29e2a868 (worker), 2026-10-29
- Where: `packages/core/src/worktree-guard.ts:60-67` (`run` judges a body where it stands), `packages/core/src/worktree-guard.ts:103-105` (the trap)
- What: a relative path in a function's body or a trap's command is resolved from the folder the call is in where the function or trap is defined, but bash runs it later, from wherever a `cd` after it left the shell. Each of these passes `worktreeRefusal` with the job's worktree as `cwd` and removes the main checkout's README.md: `f() { rm README.md; }; cd <main>; f` and `trap 'rm README.md' EXIT; cd <main>`, while `cd <main>; rm README.md` is refused (a throwaway script calling `worktreeRefusal` on the three, 2026-10-29).
- Suggestion: judge a function's body and a trap's command again from every folder the call reaches after its definition (each `cd`, `pushd`, `popd` target), or refuse a call that defines a function or a trap and changes folder after it. A name the function is called by is out: bash may call it through `$name`, an alias or another function.
- Status: open
