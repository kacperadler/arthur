# AR0582 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Five source files leave green under the width count; one goes over 250

- Kind: refactor
- Found by: 2026-10-31-worker-6cc4fb61 (worker), 2026-10-31
- Where: `packages/core/src/worktree-guard.ts:86`, `packages/core/src/jobs.ts`, `packages/core/src/shell-words.ts`, `packages/delivery/src/delivery.ts`, `packages/orchestration/src/decision-log.ts`
- What: counted as `max(1, ceil(length/160))` per line, `worktree-guard.ts` holds 273 lines (191 physical, 46 lines over 160 characters, the longest 1631 at line 86), above the 250 that fails listed or not. `jobs.ts` 229, `shell-words.ts` 229, `delivery.ts` 225 and `decision-log.ts` 222 (each 200 physical) go red, which passes only when listed in `RED_FILES` with a reason in the ticket's Decisions. `node --test --test-name-pattern="the repository keeps every rule" test/structure.test.ts` names all five. Rewrapping a long line does not lower its count; only fewer characters or a split does.
- Suggestion: split `worktree-guard.ts` below 220 [INFERENCE, not tried: `bashRefusal`, lines 52-155, is the part with its own job]; split the four red files or list them in `RED_FILES` with the owner's reasons. The counting rule itself stays.
- Status: open

## F2. `arthur plugin new` counts the new package's lines physically

- Kind: fix
- Found by: 2026-10-31-worker-6cc4fb61 (worker), 2026-10-31
- Where: `packages/develop/src/plugin-new.ts:36`
- What: the `--budget` refusal ("below the N lines the new package's src/ holds as created") counts `text.split("\n").length - 1`, not the width count of `test/structure.ts`. The template's longest src line is 122 characters for `acme` and 131 for `acme-test-plugin`, and grows with the name, so a long enough name gives a line over 160: `--budget` at the physical count is then accepted and the structure test fails on the package as created.
- Suggestion: count each src line as `max(1, ceil(length/160))` there too, with a test for a name long enough to cross 160.
- Status: open
