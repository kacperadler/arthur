# AR0637 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Mutating test/mutate.ts leaves a blocked test process running after the run

- Kind: test
- Found by: 2026-11-07-worker-d163462d (worker), 2026-11-07
- Where: `test/mutate.test.ts:102` ("a signal mid-run writes the file's bytes back and stops the running tests"), `test/mutate.ts:194-211`
- What: after `npm run mutate` on this branch, which changes `test/mutate.ts`, two processes of a `node --import …/testing.ts --test packages/a/test/limit.test.ts` were still running, each 27:51 old, in their own process group, with a cwd under `/tmp/arthur-test-*/tmp/folder-*` (`ps -o pid,ppid,pgid,etime,args`, `/proc/<pid>/cwd`). That test file is the one the signal test writes to block forever. [INFERENCE] One mutant of `test/mutate.ts` stopped `stopGroup`/the process-group kill from working, the signal test then failed and caught it, but its blocked child runs `detached` in its own group. Neither the test's temporary folder cleanup nor the outer mutate's group kill reaches that child, so it outlives the run. I stopped both by pid.
- Suggestion: the signal test kills the pid in `blocked.pid` (and its group) in a `finally`/`t.after` whatever the assertion's result. Leave mutate's own kill logic as it is.
- Status: deferred (client summary)

## F2. the counts are read from the call's output text

- Kind: fix
- Found by: 2026-11-07-review-3e9fe2ba (review), 2026-11-07
- Where: `packages/delivery/src/checks-extension.ts:77`
- What: I worked this out from the regex and did not run it. `npm run mutate -- --max 4 | sed 's/;.*//'` would cut the `; 12 not run` part, so the line becomes `mutate pass 4 run, 0 survived, 0 not run` and the gate takes it. A summary printed with `echo` would also be counted. This is the same output-trust gap as AR0579 F1.
- Status: deferred (client summary)
