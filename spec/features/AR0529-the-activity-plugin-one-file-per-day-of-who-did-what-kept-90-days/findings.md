# AR0529 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The README cannot list the activity plugin: it is at its 120-line cap

- Kind: docs
- Found by: 2026-11-06-worker-d652f2fb (worker), 2026-11-06
- Where: `README.md:54`
- What: the README lists every built plugin, one line each; a line for activity after `video` makes it 121 lines, and `test/structure.test.ts` ("the README holds at most 120 lines and one closed mermaid flowchart of at most 40") fails. The branch leaves activity out of it.
- Suggestion: shorten the README by a line (say, fold the two channel lines into one) and add `- **activity**, built: one file per day of who did what, ... ([activity](packages/activity/docs/activity.md))`. Leave the diagram as it is.
- Status: open

## F2. The diagrams and the roadmap do not show the activity plugin or entries 99 to 101

- Kind: docs
- Found by: 2026-11-06-worker-d652f2fb (worker), 2026-11-06
- Where: `arthur.mmd:53`, `docs/architecture/core-and-plugins.mmd:98`, `docs/architecture/versions.mmd:7`, `spec/roadmap.md:19`
- What: `spec/roadmap.md` names 99 to 101 as held for the activity log but has no entry for them, and no diagram has an `activity` node; this ticket's Scope In is the package, its docs and `arthur.config.example.ts`. The example config marks it `first, named`, an assumption: where 99 to 101 go in the order is AR0527's open question.
- Suggestion: once the owner places 99 to 101, write their roadmap entries and add an `activity` node to the three diagrams, built.
- Status: open

## F3. plugin-new's tests pin the budget that sorts next to `acme`

- Kind: test
- Found by: 2026-11-06-worker-d652f2fb (worker), 2026-11-06
- Where: `packages/develop/test/plugin-new.test.ts:126`, `:215`, `:294`
- What: three assertions read `acme: 40,\n\n\t<the next budget>`; the new `activity: 350` budget sorted between `acme` and `"commit-rules"` and broke four tests, fixed on this branch by naming `activity`. Any later plugin whose name sorts between `acme` and `activity` breaks them again.
- Suggestion: match the budget after `acme` as whatever the base's first budget is (read from the copy's `test/structure.test.ts`), not a name.
- Status: open
