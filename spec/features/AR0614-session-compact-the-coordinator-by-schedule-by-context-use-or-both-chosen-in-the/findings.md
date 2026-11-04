# AR0614 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. npm run mutate never runs a package's tests for a change to a root file such as arthur.config.example.ts

- Kind: test
- Found by: 2026-11-04-worker-b8b7460d (worker), 2026-11-04
- Where: `test/mutate.ts:174`
- What: for a changed file at the repository root, `tests()` walks up to the root `package.json` and runs only the root `test/*.test.ts`. A package test that reads the root file is never run, so its mutant is reported `survived:` although a test catches it. Seen on this branch: `npm run mutate -- --max 4` names `survived: arthur.config.example.ts:216: hunk reverted to the base`, while deleting lines 216-217 by hand fails `packages/session/test/session.test.ts` ("arthur.config.example.ts gives session every option of its table, each one it accepts"); `packages/delivery/test/review-needed.test.ts:223` reads the same file the same way.
- Suggestion: for a root file, also count as its importers the package tests whose text names that file (as the import scan does for `from "..."`), and run them in the second tier; leave the tier order and the rest of the selection as it is.
- Status: open
