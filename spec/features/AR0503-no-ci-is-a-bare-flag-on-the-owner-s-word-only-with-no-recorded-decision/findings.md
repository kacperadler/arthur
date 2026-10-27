# AR0503 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A merge decision lifts whichever flag the coordinator names, not the one the owner decided

- Kind: security
- Found by: 2026-10-27-worker-1a50f0e0 (worker), 2026-10-27
- Where: `packages/orchestration/src/decision-use.ts:27-56`; `packages/delivery/src/merge-command.ts:126`
- What: `decision.owner` checks a decision's kind (`merge`), ticket or job, state and use, never `what`: the question the owner answered is not tied to `--unreviewed` or `--no-ci`. So an answered `merge` decision of ticket X, asked to let X in without a PASS, also lets `--no-ci` through on the same merge (`arthur merge <job> --unreviewed --no-ci --decision <id>`: both flags ask, the second passes as the same use `merge <job>`), and an unused `merge` decision of X asked for anything else lifts either flag. Seen in the lines above; the delivery test `merge.test.ts` "a plain merge asks github.ci …" shows both flags passing on one id with its fake, which answers as orchestration does for an id.
- Suggestion: record the flag in the decision, `arthur decision ask --kind merge --for --unreviewed|--no-ci` (or the flags in the used mark: `merge <job> --unreviewed`), and refuse in `refusal` a decision whose recorded flag is not `what`. Out: `arthur take-main`'s own decisions, which already need no ticket and no job.
- Status: open
