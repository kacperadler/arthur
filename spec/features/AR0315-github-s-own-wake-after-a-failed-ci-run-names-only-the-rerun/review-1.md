# AR0315 - Review 1

- Job: 2026-10-23-review-ar0315-7b0781f5
- Branch: h/2026-10-23-ar0315-9c70bd16
- Commit reviewed: 93eba100e6edc9213fc533657d5d9bd4bd90d935
- Verdict: PASS

## Final message

No findings that block merge.

Notes:
- Limit stated by worker (first-branch-only naming when several share a run) is pre-existing `arthur ci` behavior, correctly disclosed, not a new gap.
- Single commit, scoped exactly to the ticket's Done means; docs (`packages/github/docs/github.md`, `docs/commands/ci.md`), eval scenario, structure budget with Decision recorded, and tests all updated together.

Checks run (in this worktree, at `93eba10`):
- `npm ci`: clean.
- `npm run check` (tsc): no errors.
- `npm test`: 1048/1048 pass, matches worker's claim.
- `node --test packages/github/test/github.test.ts` isolated: 14/14 pass.
- `cat packages/github/src/*.ts | wc -l` → 633, matches the raised budget and worker's claim.
- Mutation `job === undefined ?` → `job !== undefined ?`: both wake tests fail (owner/worker text swapped) — caught.
- Mutation `each.branch === rest[0]` → `each.branch !== ""`: both wake tests fail (wrong job id picked / main gets worker wording) — caught.
- Reverted both mutations (`git checkout -- packages/github/src/github.ts`); `git status --short` clean afterward.
- Read `host.jobs.list()` is a published `Jobs` member (`packages/core/src/jobs.ts:91`), already used elsewhere in this file and in delivery — no plugin-boundary violation.
- Confirmed delivery's wake wording (`packages/delivery/src/ci-wait.ts:67`) textually matches the new github wording, as the ticket requires ("as delivery's does").
- Ticket's Decisions updated with the budget-raise rationale, test file's budget comment updated accordingly.

PASS
