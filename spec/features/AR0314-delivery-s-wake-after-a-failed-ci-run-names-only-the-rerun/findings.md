# AR0314 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. GitHub's own wake after a failed CI run names only the rerun

- Kind: improvement
- Found by: 2026-10-23-ar0314-79966166 (worker), 2026-10-23
- Where: `packages/github/src/github.ts:93`
- What: for a branch with no delivery wait, github's wake ends `Why: arthur ci <branch> --project <project>; rerun it once: … --rerun`, naming the rerun and not `arthur continue` that `packages/github/docs/commands/ci.md` "What the coordinator does with it" asks for when the failure is in the branch's own code. AR0314 changed only delivery's wake (`packages/delivery/src/ci-wait.ts`). The eval `packages/github/evals/ci-failed` checks the coordinator continues anyway on this wording.
- Suggestion: for a branch `arthur/<job>`, end the second line as delivery's does: `then a failure in the branch's own code goes back to its worker: arthur continue <job> '<the failed step and its lines>'; one that looks transient … is rerun once: … --rerun`; for `main`, which has no worker, keep the rerun and name the owner. Update `docs/github.md`, its tests and the eval's turn.
- Status: ticket AR0315
