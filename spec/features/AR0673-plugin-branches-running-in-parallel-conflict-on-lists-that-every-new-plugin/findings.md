# AR0673 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. arthur.mmd still holds a hand-kept core count and lacks two built plugins

- Kind: docs
- Found by: 2026-11-10-worker-59d8d359 (worker), 2026-11-10
- Where: `arthur.mmd:13`
- What: the core subgraph's title says "26 of 27 core entries built", a count kept by hand like the status line this ticket dropped, and it has drifted the same way (the dropped line listed no core entry 99, 104 or 108). The diagram also has no node for `packages/activity` or `packages/herdr`, both built. The ticket's Scope leaves the diagram's content out.
- Suggestion: drop the count from the title (the roadmap page computes it, AR0634) and add the two plugin nodes, each with its own `class <node> built;` line in name order.
- Status: open

## F2. docs/setup.md names docker as the first planned package

- Kind: docs
- Found by: 2026-11-10-worker-59d8d359 (worker), 2026-11-10
- Where: `docs/setup.md:118`
- What: the line quotes `Cannot find package '@arthur/docker'` as the error a copy of `arthur.config.example.ts` fails with, so the branch that builds docker must edit it too; this ticket made the example's own header say `'@arthur/<name>'` instead.
- Suggestion: quote `Cannot find package '@arthur/<name>'` there too.
- Status: open

## F3. Two new plugins' sections at one spot of the example config still conflict

- Kind: chore
- Found by: 2026-11-10-worker-59d8d359 (worker), 2026-11-10
- Where: `arthur.config.example.ts:84` (`plugins: [`)
- What: the plugins' calls are in no order (load order matters: nvm before projects), and a new built plugin goes after the last built one, before `develop({` (activity, then herdr). With `git merge-tree --write-tree` on two throwaway branches of this ticket's commit, `kiosk` and `lamp`, each adding its section after `herdr(),`, the merge conflicts in `arthur.config.example.ts` only; the same two plugins with sections at different spots merge cleanly. This ticket's Scope changed only the file's header.
- Suggestion: a rule in the file's header for where a new plugin's call goes (in name order among the calls that need no load order, say), so two branches pick different spots; the calls whose order matters stay as they are.
- Status: open
