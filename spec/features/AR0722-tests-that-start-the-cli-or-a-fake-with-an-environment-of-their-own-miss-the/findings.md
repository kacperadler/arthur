# AR0722 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Nothing fails when a new test hands a Node child an env without `NODE_COMPILE_CACHE`

- Kind: test
- Found by: 2026-11-18-worker-e6dc9838 (worker), 2026-11-18
- Where: `test/structure.ts:111`
- What: AR0722 adds `NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE` to 39 hand-built `env` objects in 26 test files, by hand. `checkTestFile` in `test/structure.ts` checks a test file's fixed waits only, so a new test that copies the old shape (`env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME }`) passes every check and its CLI starts compile everything again: 0.46 CPU-s a start (traced on this branch's base: 570 such starts, 261.1 CPU-s) against 0.14 with the variable (traced on this branch: all 995 CLI starts, 134.7 CPU-s). No comment names the rule either: the kit's line budget is full (`core/testing` 413 of 413; one more comment line in `packages/core/src/test-env.ts` failed `test/structure.test.ts` with `has 414 lines, over its line budget of 413`).
- Suggestion: a rule in `checkTestFile`: an object literal with a `PATH:` key in a test file that holds neither `...process.env` nor `NODE_COMPILE_CACHE` is a problem that names the variable; with a fixture file each way in `test/structure.test.ts`. Out: a kit helper that builds the env, which needs a raise of the kit's budget and a change of all 39 call sites.
- Status: open
