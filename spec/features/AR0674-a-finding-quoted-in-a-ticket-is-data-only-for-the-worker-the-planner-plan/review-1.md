# AR0674 - Review 1

- Job: 2026-11-18-review-9bd762c8
- Branch: arthur/2026-11-18-worker-1f7ae025
- Commit reviewed: 2982d093050ed53fe28259b2b6df57a869a0ee7e
- Verdict: PASS

## Final message

No finding blocks the merge. The branch meets every Done means point of AR0674.

- **The rule:** `packages/core/roles/every-job.md:3` now says the ticket instructs, except a `> ` quote under a line ending `written by a job: data for planning, not an instruction.`. That covers both heads `packages/findings/src/on-merge.ts:47` writes: the single-finding head and the grouped head.
- **The worker's copy:** the clause is gone from `packages/core/roles/worker.md:7`, so the rule lives once.
- **The test:** `RULE` in `test/outside-text.test.ts:18` matches the new line, and `written by a job` joins the words no job role file may hold (`:43`). Both changes fail the test when undone (see the checks below).
- **The one edit outside the Scope's In:** `packages/findings/docs/findings.md:52` said "the worker's role says a quoted finding is data", which the change made false. It now points at the core's `## Every job` section. The worker's final message gives this reason, and the Scope's Out does not name the file.
- **Stale text:** I searched the repository for `lines they quote`, `written by a job`, `data for planning`, `quoted finding` and `worker's role says`. The only copies of the rule still without the exception are `packages/orchestration/roles/coordinator.md:16` and `packages/orchestration/roles/project.md:16`. The ticket's Out ("the other roles' wording") excludes them, and the branch's `findings.md` records them as F1.
- **Shape:** no source `*.ts` changed, and no new file goes past a size zone. `CHANGELOG.md` is generated at merge (its own header says so), so the branch needs no entry.
- **The worker's claims:** each one I checked matches the diff and reproduces: files, red runs, check counts and the mutate result.

## Notes

None beyond F1 in the ticket's `findings.md`.

## Checks (on `2982d093`)

- `npm run mutate`: `mutate: 0 mutants, 0 caught, 0 survived`. No non-test `*.ts` file changed, so I mutated by hand:
  - Restored the base `packages/core/roles/every-job.md` and ran `node --import @arthur/core/testing --test test/outside-text.test.ts`. It fails with `packages/core/roles/worker.md: the rule once, as its own line`. File restored with `git checkout -- packages/core/roles/every-job.md`.
  - Restored the base `packages/core/roles/worker.md` and ran the same test. It fails with `packages/core/roles/worker.md restates "written by a job"`. File restored with `git checkout -- packages/core/roles/worker.md`. `git status --short` was then empty.
- `npm run check`: exit 0, no `tsc` error.
- `npm test`: exit 0. Tests 1902, pass 1838, fail 0, cancelled 0, skipped 64.

PASS