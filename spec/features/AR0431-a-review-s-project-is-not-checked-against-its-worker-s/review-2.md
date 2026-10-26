# AR0431 - Review 2

- Job: 2026-10-26-review-b8dc2076
- Branch: arthur/2026-10-26-worker-ccfd2e9b
- Commit reviewed: e19789a25e8877d9e870771d9e47d4d718a89dac
- Verdict: PASS

## Final message

I found nothing that blocks the merge. Review 1's FAIL is fixed: `refusal` now compares the spawn's `project` with the `project` of the worker record that `worker()` returns. The second search of `host.jobs.list()` by branch is gone, and with it the hole review 1 found, which let any job in the other project satisfy the check.

## Findings

None.

## Notes (not blocking)

- **The fix:** `packages/delivery/src/delivery.ts:52` passes the `project` that `beforeSpawn` gets into `refusal`. At `:126-127` a review starts only when `job.project === project` and the task rebuilt by `reviewTask` matches byte for byte. Any other case falls through to the same refusal message as before, as Done means asks.
- **No path refused by mistake:** delivery's own review spawns (`review-command.ts:28` and `hand-back.ts:84`) already pass `project: job.project`, so neither is refused by the new check.
- **The test:** `test/review.test.ts:312-330` spawns a worker in `beta`, waits for it to end and checks its record says `beta`. `beta`'s HEAD holds the ticket and the worker's tip is fetched into it. The test then checks three things:
  - the exact task spawned with `project: "beta"` is refused with the exact message;
  - the number of job records does not change;
  - the same task in `acme` starts and its record says `acme`.
- **Doc page:** `packages/delivery/docs/commands/review.md` is outside the ticket's Scope. It is the doc page of the changed refusal, as the review criteria require, and the text is accurate.
- **Line budget:** delivery's source is 1337 lines, its budget in `test/structure.test.ts:678` is 1337, and the range does not raise it.
- **Commits:** the two commits follow Conventional Commits with `AR0431` as the scope.
- **Outside the range (one line):** the core test "an agent that ignores SIGTERM at its limit gets SIGKILL after the grace…" (`packages/core/test/limits.test.ts`) failed once in my second full run and passed alone and in the first run. It is timing-sensitive, and the range does not touch core.

## Checks run

- `npm ci`: exit 0.
- `npm run check`: exit 0.
- `npm test`, run twice:
  - first run: exit 0;
  - second run: 1136 tests, 1077 pass, 1 fail, 58 skipped. The failure is the core limits test above. Run alone with `--test-name-pattern="ignores SIGTERM at its limit"`, it passes, 1 of 1.
- `node --import @arthur/core/testing --test test/review.test.ts` (in `packages/delivery`): 16 of 16 pass.
- `node --test test/structure.test.ts`: 16 of 16 pass.
- `cat packages/delivery/src/*.ts | wc -l`: 1337, as the worker said. `delivery.ts` is 174 lines.
- Mutations, each run alone against `--test-name-pattern="project other than"` and restored with `git checkout -- src/delivery.ts`. My first batch ran in parallel on the same file, so I threw those results away and reran each one by itself:
  - `job.project === project` → `true`, the project check removed (the same effect as review 1's mutation): caught, `Missing expected rejection`.
  - `job.project === project` → `job.project !== project`: caught, `Missing expected rejection`.
  - The hook passes `""` instead of `project`: caught, the review in `acme` is refused.
  - The hook passes `"acme"` instead of `project`: caught, `Missing expected rejection`.
  - Main's `delivery.ts` (aeae6c96): the new test fails, `Missing expected rejection`, so it fails on main as Done means requires.
- `git status --short` after restoring: clean.

PASS