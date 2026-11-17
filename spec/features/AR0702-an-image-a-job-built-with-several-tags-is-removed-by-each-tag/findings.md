# AR0702 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. No test holds the exit 1 of `arthur docker sweep` stopped half-way

- Kind: test
- Found by: 2026-11-17-worker-5c92907a (worker), 2026-11-17
- Where: `packages/docker/src/docker-sweep.ts:107`
- What: `npm run mutate` on this branch's first commit turned the half-way return's `failed: true` into `failed: false` and every test still passed (`survived: packages/docker/src/docker-sweep.ts:107`). The test "Docker stopping half-way, or the removal cut by its limit" runs only the daily entry, whose notice goes out anyway since something was reclaimed; nothing runs the sweep by hand there, so the exit 1 that `docs/commands/docker-sweep.md` promises for a sweep failed half-way is not held. The final branch no longer changes that line, so the mutant no longer shows.
- Suggestion: in that test, run `arthur docker sweep` by hand against the same `crash: "network rm"` state and assert exit 1; nothing else changes.
- Budget: 0.5
- Status: deferred (client summary)
