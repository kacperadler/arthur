# AR0632 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A test run leaves a fake agent with the session plugin's handoff extension running

- Kind: test
- Found by: 2026-11-09-worker-544a2960 (worker), 2026-11-09
- Where: `packages/core/src/fake-agent.ts`, started with `-e packages/session/src/handoff-extension.ts`; the test that starts it is not identified
- What: after `npm test` and `npm run mutate` on this branch (neither touches the session plugin), `ps` showed `node packages/core/src/fake-agent.ts /tmp/arthur-test-PMSf11/tmp/folder-DOqNV0/run.json --continue -e packages/session/src/handoff-extension.ts` still running 15 minutes later, reparented to pid 817; it was killed by hand. A test that leaves a process behind breaks the styleguide's rule that a test removes what it starts.
- Suggestion: find the test that continues a job with the handoff extension (`grep -rn "handoff" packages/*/test`), and stop the agent it starts in its `t.after`, waiting until the process is gone.
- Status: open
