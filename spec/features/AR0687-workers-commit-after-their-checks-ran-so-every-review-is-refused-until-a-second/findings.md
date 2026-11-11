# AR0687 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. An extension that throws in a job's sandbox fails silently, so a broken reminder ships green

- Kind: test
- Found by: 2026-11-11-worker-bd554130 (worker), 2026-11-11
- Where: `packages/delivery/test/checks.test.ts:287`, `packages/delivery/src/checks-extension.ts:49`
- What: AR0656's run-end reminder never fired in a sandboxed job from its merge (2026-11-09) to this branch: its `session_stop` handler read `<home>/delivery/<id>/checks`, which the AR0590 sandbox let the agent write but not read, so it threw `EACCES` and omp dropped the answer. The only trace is a line `Extension error (.../checks-extension.ts): EACCES: permission denied, open '.../checks'` in the job's `log` (seen in the logs of jobs 2026-11-09-worker-69fae305, 2026-11-10-worker-042e7671, 2026-11-10-worker-4b7cab02); no session of those jobs holds a checks reminder, only processes reminders. The extension's own tests call its handlers in the test process, outside any sandbox, so they passed. This branch makes the folder readable and pins that read in `test/job-home.test.ts`; nothing yet catches the next extension that reads or writes something its sandbox refuses.
- Suggestion: a test that loads each extension a plugin registers in a real job's sandbox (as `test/job-home.test.ts` spawns one) and plays its handlers, or the wrapper naming an `Extension error` line of the agent's output in the job's wake. Out: the reminders' wording.
- Status: open
