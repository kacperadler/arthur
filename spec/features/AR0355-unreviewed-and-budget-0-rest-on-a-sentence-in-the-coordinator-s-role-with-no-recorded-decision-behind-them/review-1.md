# AR0355 - Review 1

- Job: 2026-10-26-review-106fdff2
- Branch: arthur/2026-10-26-worker-7e524535
- Commit reviewed: c317231bc65bf25c8488bca30142f4dc54d824bb
- Verdict: FAIL

## Final message

## Findings

1. **`npm test` fails, and the ticket's Done means requires it to pass.** The cause is `packages/core/test/jobs.test.ts:142`, "a beforeSpawn reason, or a check that throws, refuses with the plugin's name before anything exists". The branch did not touch that test, but the change at `packages/core/src/jobs.ts:164` adds the key `decision: picked.free ? undefined : request.decision` to every `Spawn`. That test compares the `Spawn` with `deepStrictEqual`, which treats a key set to `undefined` as a difference, so it now fails with `+ decision: undefined`. I reproduced it on its own: `node --import @arthur/core/testing --test test/jobs.test.ts` gives 13 tests, 12 pass, 1 fail. The worker says it did not run the full `npm test`, and "all the checks I ran pass" does not hold for the full suite.

2. **The job scope of a continue's `--budget 0` is untested.** At `packages/orchestration/src/decision-use.ts:20`, I changed `job: id` to `job: undefined` in the `beforeSpawn` refusal call. `decision-use.test.ts` and `decisions.test.ts` still pass (32/32). The ticket requires "for this job's ticket (or this job, for one without a ticket)". With this mutation, `arthur continue <ticket-less job> --budget 0` would refuse the owner's `--job <id>` decision and accept one tied to no ticket and no job, and no test would catch it. No orchestration test runs a continue at all; core's `job-control.test.ts` only checks that `decision` and `id` reach a fake check.

## Notes

- The refusal tests live in `packages/orchestration/test/decision-use.test.ts`, not in the `merge.test.ts`/`spawn.test.ts` the ticket names. The worker gave a reason: the styleguide's rule that a plugin is never tested against another real plugin. That reason is acceptable.
- `decision ask --job` stores the id as typed, so a decision asked with the short job id is refused at merge ("is of job 7e524535, not of job …"). It fails closed, so this is only a usability issue.
- A decision is marked used before later `beforeSpawn` checks run, so a spawn refused by another plugin still uses it up. This is disclosed in `decision.md`.
- The fixtures use the owner's words "tak" and "zawsze" (Polish), as `decisions.test.ts` already does.
- The new rule holds against other input forms: `--decision=X`, a repeated `--decision`, an empty or `-`-led value, a lower-case id, a policy answer later replaced by the owner's, and two writers at once (the `wx` flag). `host.call` throws when orchestration is not loaded, so a merge fails closed.

## Checks run

- `npm ci`: ok.
- `npm run check`: clean.
- `npm test`: **1 failure**, `packages/core/test/jobs.test.ts:142`, as in finding 1.
- `node --import @arthur/core/testing --test test/jobs.test.ts` in core: 12 pass, 1 fail.
- Mutations in `decision-use.ts`, each run against `decision-use.test.ts`:
  - policy check disabled: caught (1 fail).
  - same-merge retry exception removed: caught.
  - answered-state check disabled: caught.
  - job-scope condition removed: caught.
  - `wx` changed to `w`: caught (2 fail).
  - `job: id` changed to `job: undefined` in `beforeSpawn`: **not caught** (32/32 pass with `decisions.test.ts`).
- Mutation in `merge-command.ts`, `if (owner !== "") throw` disabled: caught by `merge.test.ts` (16 pass, 1 fail).
- Mutation in `jobs.ts`, the continue's `job.free ? undefined :` removed: caught by `job-control.test.ts` (25 pass, 1 fail).
- All mutations restored; `git status` is clean.

FAIL