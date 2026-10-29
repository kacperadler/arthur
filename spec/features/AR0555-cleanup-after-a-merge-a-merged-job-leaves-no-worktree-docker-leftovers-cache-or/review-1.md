# AR0555 - Review 1

- Job: 2026-10-29-review-3195f4cc
- Branch: arthur/2026-10-29-worker-b17e611d
- Commit reviewed: c3e80d0d4d522f3b9867182e0f794f23ef815a9c
- Verdict: FAIL

## Final message

Verdict: FAIL. Nothing tests that a merge or a drop prunes only the jobs of its own ticket. On a drop, the jobs it picks get their unmerged branches deleted with `git branch -D`, so a wrong pick loses committed work. The rest of the branch holds up, and the checks reproduce exactly.

## Findings

1. **`packages/delivery/src/ticket-prune.ts:13`: the ticket match has no test, and removing it is not caught.** I replaced the match `basename(FEATURE.exec(path)?.[1] ?? "").startsWith(`${ticket}-`)` with `FEATURE.test(path)`, so any job naming any ticket of the project counts. `merge.test.ts` and `review.test.ts` still pass, 45 of 45. With that mutation, dropping one ticket would delete the unmerged branches of every ended job of every other ticket in the project. A merge would also prune those jobs' worktrees and records.
   - The drop test's title says "another ticket's or project's job … keep theirs". But no job in it names another ticket: `loose` has the task "No ticket here." and `orphan` is in another project.
   - Moving the boundary by one is not caught either: `startsWith(`${ticket}`)` without the `-` also passes, 45 of 45. Once ids reach five digits, dropping AR1000 would also force-delete the branches of AR10001 to AR10009.
   - Under the review criteria, a mutation of a key behavior on a destructive path that no test catches is a FAIL. The fix: a worker on a second ticket (say `AC0002`) and one on an id that only shares the prefix, both kept through a merge and through a drop.

## Notes (not blocking)

- **Push record only on success:** at `packages/github/src/github.ts`, dropping the check `line.startsWith("github: pushed ")` (so a failed push still records its tip) passes all 38 github tests. In practice this seems harmless: a recorded tip origin never got cannot match origin's tip, so the prune falls back to the "in main" check. A one-line test would still be cheap.
- **F1, a problem this branch causes:** a drop now prunes a FAILed worker that is still waiting to be handed back. The coordinator is then told to run `arthur continue <id>`, which can only fail. `review.test.ts` was changed (an uncommitted draft keeps the worker) so it no longer hits this; the problem is filed as F1 in the ticket's `findings.md`, status open.
- **Eval stub:** in `packages/delivery/evals/review-pass/scenario.json`, the stubbed merge output prunes only the worker. A real merge would also prune the ended review `1f2e3d4c` of the same ticket.
- **Departure from the plan, with a reason given:** the plan named `arthur github sweep-branches` in `github-branches.ts`. The branch adds it as `arthur github branch sweep` in `github-branch.ts`, as a verb of the `arthur github` command that AR0557 added; the worker's message says so. It fits the ticket's "or" wording.
- **Line budgets:** github 951 and delivery 1723 in `test/structure.test.ts` match AR-D335.

## Checks I ran

- `npm ci`, `npm run check` (tsc): pass.
- `npm test`: 1307 tests, 1245 pass, 0 fail, 62 skipped, as the worker claims.
- `node --test test/github-branch.test.ts`: 6 of 6 pass.
- Mutations; every file restored with `git checkout --`, and `git status --porcelain` came back empty:

| Mutation | Tests | Result |
|---|---|---|
| Ticket match → `FEATURE.test(path)` | `merge.test.ts` + `review.test.ts` | **not caught** (45/45 pass) |
| `${ticket}-` → `${ticket}` | `merge.test.ts` + `review.test.ts` | **not caught** (45/45 pass) |
| Push recorded on a failed push | all github tests | **not caught** (38/38 pass) |
| `&& job.machine === "local"` removed | drop test | caught |
| `&& job.state === "ended"` removed | drop test | caught |
| `job.project === project &&` removed | drop test | caught |
| github deletes no longer queued one by one | `github-branch.test.ts` | caught (2 fail) |
| `&& !inMain(path, tip)` removed | `github-branch.test.ts` | caught |
| `tip !== pushed &&` removed | `github-branch.test.ts` | caught |

FAIL