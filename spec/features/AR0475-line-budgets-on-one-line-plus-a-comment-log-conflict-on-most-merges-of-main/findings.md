# AR0475 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Two new plugins made at once still conflict in BUDGETS

- Kind: chore
- Found by: 2026-10-27-worker-042433a0 (worker), 2026-10-27
- Where: `packages/develop/src/plugin-new.ts:98`
- What: `arthur plugin new` adds the new budget as the last one in `BUDGETS`, so two branches that each make a plugin insert at the same place, and Git conflicts there. Reproduce: copy `test/structure.test.ts` to `base`, make `ours` with `\tacme: 40,\n\n` and `theirs` with `\tzeta: 5,\n\n` after `\tfindings: 254,\n\n`, and run `git merge-file -p ours base theirs`: one conflict. Raises, the common case, merge cleanly (`git merge-file` on raises to `core`, `core/testing` and `findings`: 0 conflicts).
- Suggestion: insert the new budget in name order instead of last, so two new plugins with different names land at different places; the rest of the form stays. Worth it only if new plugins start landing in parallel; today one lands every few days.
- Status: open
