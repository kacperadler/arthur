# AR0599 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. npm run mutate ends with exit 143 partway through, inside a job

- Kind: test
- Found by: 2026-10-31-worker-111db639 (worker), 2026-10-31
- Where: `test/mutate.ts:32`
- What: inside this job's sandbox, `npm run mutate; echo "mutate exit=$?"` on commit ff6983fb printed four `survived:` lines and then `mutate exit=143` after 1895 s; an earlier run on the same commit, `npm run mutate 2>&1 | tail -n 60` (its exit status not seen), printed no `survived:` line and ended after 220 s, so it too stopped before the mutants the second run named. 143 is 128 + SIGTERM, which `mutate.ts:32` turns into `process.exit(143)`, so something sent the mutate process a SIGTERM before it had run every mutant. Each test run already starts in a process group of its own (`detached: true`, `mutate.ts:184`), so it is not a stop of that group [INFERENCE: a test that signals a pid it read, which mutate's pid could be, or a signal from outside the job]. The tree was restored both times (`git status --short` empty). A run that ends so says nothing of the mutants it never ran.
- Suggestion: print `mutate: stopped by <signal> after <n> of <m> mutants` before the exit, and log which mutant's test run was running, so the sender can be found.
