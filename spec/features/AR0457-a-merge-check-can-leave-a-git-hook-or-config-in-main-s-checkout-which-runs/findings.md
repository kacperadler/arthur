# AR0457 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A merge check cannot make, rename or remove an entry at the top of main's checkout

- Kind: ux
- Found by: 2026-10-26-worker-c3335bc0 (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`checkout`, called by `stepSandbox`)
- What: Landlock only grants, and a right on a folder holds for all beneath it, so a step that may make an entry in the checkout's own folder may also make `.git/hooks/post-commit`. AR0457 therefore grants each top-level entry but `.git` (and Arthur's home, config and env file), not the checkout's folder itself: a check that makes a new top-level folder or file (`dist/`, `coverage/`, `tsconfig.tsbuildinfo`), or removes or renames one, fails with `Permission denied` (seen in a throwaway run: `mkdir dist` and `rm -r src` refused in a step, a write into `src/` passed). The list is read once per merge, so after a failed check's `git reset --keep` the reinstall cannot write a top-level folder the reset brought back. `docs/commands/merge.md` says so and names the remedy (`mkdir dist` once outside a step).
- Suggestion: if a project needs it, run each step in a mount namespace with `.git/config`, `.git/hooks`, `.git/info`, the home and the config bind-mounted read-only (needs unprivileged user namespaces, which some hosts turn off), or let a project's config name the top-level folders the checks make, which `arthur merge` creates before the first step. Out: changing Landlock's model.
- Status: open
