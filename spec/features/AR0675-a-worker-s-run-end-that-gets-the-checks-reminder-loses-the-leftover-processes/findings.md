# AR0675 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. processes-extension.ts keeps an empty default export for job records written before AR0675

- Kind: chore
- Found by: 2026-11-18-worker-193ee6d4 (worker), 2026-11-18
- Where: `packages/delivery/src/processes-extension.ts:22`
- What: a job's record keeps the extensions of its spawn in `extensions`, and the wrapper loads each of them again in every later run (`packages/core/src/wrapper.ts:78-87`). A job spawned before AR0675 names `../../delivery/src/processes-extension.ts` there, so the file keeps a default export that registers nothing; without it the fake agent's load of that file throws (`packages/core/src/fake-agent.ts:93-94`), and what omp does is not known. `packages/delivery/test/processes.test.ts`, "a job whose record, written before AR0675, ...", holds it.
- Suggestion: once no job record that may still be continued names `processes-extension.ts` in its `extensions` file, on any machine, remove the default export, its test and the last sentence of `packages/delivery/docs/delivery.md`, "Processes a job leaves running". Out: a wrapper that skips an extension file that is gone.
- Status: open
