# AR0569 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. job-steered's kind is pinned only for worker jobs

- Kind: test
- Found by: 2026-10-30-review-50d16525 (review 1, not blocking)
- What: `packages/core/src/job-commands.ts:22`: hard-coding `kind: "worker"` passes both job-records tests; steering a review job would pin it.
- Status: deferred (client summary)

## F2. The fake agent's last-answer-without-input case is untested

- Kind: test
- Found by: 2026-10-30-review-50d16525 (review 1, not blocking)
- What: `packages/core/src/fake-agent.ts:98`: `findLast(each => each?.input !== undefined)` still passes; the code matches omp 18.3.0.
- Status: deferred (client summary)

## F3. Ways around the pkill refusal

- Kind: risk
- Found by: 2026-10-30-review-50d16525 (review 1, not blocking)
- What: `packages/core/src/worktree-guard.ts:115`: busybox, coproc, exec -a, watch, flock, strace, script -c, su -c, a variable or `$(...)` as the verb, skill, killall5, kill -9 -1, kill $(pgrep ...) are not refused; most come from the guard's parser, which the plan leaves alone.
- Status: deferred (client summary)

## F4. The commit subjects use scope core, not the ticket id

- Kind: chore
- Found by: 2026-10-30-review-50d16525 (review 1, not blocking)
- What: the commit rule refused `AR0569:`; the id is in the body.
- Status: deferred (client summary)

## F5. cli.ts changed outside the file list

- Kind: chore
- Found by: 2026-10-30-review-50d16525 (review 1, not blocking)
- What: `packages/core/src/cli.ts`: one line, the existing `need("", ...)` pattern, explained by the worker.
- Status: deferred (client summary)
