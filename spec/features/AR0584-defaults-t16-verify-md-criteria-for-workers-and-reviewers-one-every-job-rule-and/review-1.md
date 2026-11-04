# AR0584 - Review 1

- Job: 2026-11-04-review-431c308d
- Branch: arthur/2026-11-04-worker-e0340669
- Commit reviewed: 9eac3e7b9a74b9adebddffc70325c1c61c2fc8fc
- Verdict: FAIL

## Final message

I'm failing this branch on two things: one key behaviour has no test, and one doc page wasn't updated. Everything else matches the ticket and the plan. `npm run check` and `npm test` pass, and the line budgets hold up.

## Findings

1. **`packages/delivery/src/delivery.ts:57`: no test checks that the reviewer reads `verify.md`.** The ticket's Goal says the reviewer's criteria are `["styleguide","review","verify"]`. I put the old `["styleguide", "review"]` back and every test still passed: `test/arthur-criteria.test.ts` alone gave 2 pass, 0 fail, and with all of `packages/delivery/test/*.test.ts` it was 123 pass, 0 fail. The only check, `arthur-criteria.test.ts:32`, compares the set of criteria all loaded roles read, and the worker already adds `verify` to that set. Commit `9eac3e7b` ("the worker and reviewer read verify.md here") therefore doesn't check the reviewer, though its title says it does. Under the review criteria, a mutation of a key behaviour that no test catches is a FAIL.

2. **`packages/core/docs/commands/spawn.md:18` and `:132` describe a rule the branch deleted.** Line 18 says "otherwise the job installs from the lockfile itself, as the worker's role tells it". Line 132 says "an `npm ci` it runs itself, as the worker's role tells it to where no install ran". The branch removed that line from `worker.md` (the ticket's `worker.md:17`), and nothing under `packages/core/roles/` mentions installing or a lockfile any more. `spawn.md` isn't in the Scope's Out, so under the review criteria this stale doc is a FAIL.

## Delivery's +21 lines (plan said +8)

Every line of `worker-criteria.ts` (19 lines) earns its place, and with the 2 lines in `delivery.ts` that makes the 21:
- The core's criteria reader is not in `@arthur/core`'s exports, so the plugin has to read the file itself.
- Each check does real work: it uses the project's `criteriaDir`, picks the worktree or the main checkout, refuses a symlink or a non-file, and adds nothing for a missing or empty file.
- Dropping the symlink or non-file check would let a link pull another file into the prompt.

I removed or changed each check by hand and the tests caught it: the `isFile` check, the realpath check, always reading the worktree, ignoring `criteriaDir`, adding an empty file, and giving the section to any role but the reviewer. Each made `worker-criteria.test.ts` fail (3 pass, 1 fail). The core's +5 and manage's +15 fall within the plan's estimates.

## Proving the key tests against the base
The worker skipped this, so I did it by hand:
- **Every job section:** removing `EVERY_JOB` from the spawn prompt (`jobs.ts:145`) fails `test/outside-text.test.ts` (2 pass, 1 fail).
- **Worker reads `verify`:** removing it from the worker's criteria fails 4 tests in `roles.test.ts` and `arthur-criteria.test.ts`.
- **Retro corrections (`retro.ts`):** each of these fails `retro.test.ts` (9 pass, 1 fail):
  - removing the project filter, the "since" filter or the text-type check;
  - flipping the sort;
  - moving the 200-character cut to 201;
  - dropping the first-sentence split.

## Notes
- (minor) packages/delivery/src/worker-criteria.ts:15: the realpath of the checkout isn't tested. If `join(realpathSync(checkout), path)` becomes `join(checkout, path)`, the tests still pass; with a symlinked checkout path every `review.md` would then be refused as a symlink.
- (minor) packages/manage/src/retro.ts:142: the boundary of the "since" filter isn't tested. Changing `<` to `<=` (dropping a correction made exactly at the last retro's commit time) still passes.
- (risk) packages/delivery/roles/reviewer.md:11: the line "run the checks in your own checkout, compare with what the worker claims" now lives only in a project's `verify.md`. A project that keeps the headings-only skeleton from `arthur init` loses that instruction.

## Checks run
- `npm ci`, `npm run check`, `npm test` in one call (timeout 1800 s): tsc clean; 1505 tests, 1441 pass, 0 fail, 64 skipped. This matches the worker's claim. The structure test passed with core 7158, delivery 2085, manage 1355.
- The hand mutations above, each run against its own test files. Every file was restored with `git checkout --` and `git status --short` came back clean.
- I did not run `npm run mutate`; I used the hand mutations instead, to keep within the budget the owner set.

FAIL