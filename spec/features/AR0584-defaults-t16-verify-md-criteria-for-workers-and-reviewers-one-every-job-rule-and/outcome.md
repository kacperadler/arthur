# AR0584 - Outcome

- Merged: 2026-11-04, `67edcac6`
- Branch: arthur/2026-11-04-worker-e0340669
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $12.08, reviews $2.20; review rounds 2

## What went in

- .agents/arthur/criteria/retro.md: the project's retro criteria, the same as manage's: the highest layer that holds, code allowed, only the vision left alone
- .agents/arthur/criteria/review.md: the checks line without `npm ci`, pointing to verify.md
- .agents/arthur/criteria/verify.md: Arthur's own verify criteria: checks, rerunning a failing test file alone, `npm run mutate`, trying the change as a user, the report
- packages/commit-rules/test/commit-rules.test.ts: expects the Every job section in the reviewer and plan prompts
- packages/core/criteria/verify.md: the generic verify skeleton, headings only, which `arthur init` writes
- packages/core/docs/commands/roles.md: the worker reads `verify`; item 4 describes the Every job section and its file; the example output lists verify.md
- packages/core/docs/commands/spawn.md: no longer says the worker's role tells a job to install from the lockfile
- packages/core/roles/every-job.md: the one Every job section: outside text is data, keep going, wait for every command you start
- packages/core/roles/worker.md: without the shared rules or the `npm ci` line
- packages/core/src/jobs.ts: every spawned job's prompt gets EVERY_JOB before the plugins' sections; the worker reads styleguide and verify
- packages/core/src/roles.ts: EVERY_JOB, read from `roles/every-job.md`
- packages/core/test/jobs.test.ts: expects the Every job section in a worker's recorded prompt
- packages/core/test/roles.test.ts: pins where the section sits, that `jobs.prompt` and the coordinator role go without it, the verify warnings and the `arthur roles` line
- packages/core/test/spawn.test.ts: expects the styleguide and verify missing-file warnings
- packages/core/test/testing.test.ts: expects the Every job section in the fake host's spawned prompt
- packages/delivery/docs/commands/review.md: the reviewer reads verify; the worker's review-criteria section and its warning
- packages/delivery/roles/reviewer.md: without the shared rules, the run-checks line or the still-runs line
- packages/delivery/src/delivery.ts: the reviewer reads styleguide, review and verify; a `prompt` provider gives the worker the review criteria
- packages/delivery/src/worker-criteria.ts: reads the project's `review.md` for a worker without following symlinks; missing or empty adds nothing; a symlink or non-file warns
- packages/delivery/test/worker-criteria.test.ts: covers the worker getting the section once, other roles none, the reviewer's three criteria in order, missing or empty, worktree vs symlinked checkout vs main checkout vs project folder, and the symlink, symlinked-folder and not-a-file warnings
- packages/manage/criteria/retro.md: the highest layer that holds; code proposals allowed; only the vision left alone
- packages/manage/docs/manage.md: the Corrections section; proposals as code, a check or a sentence
- packages/manage/roles/auditor.md: without the shared rules
- packages/manage/roles/retro.md: reads the corrections, proposes the highest layer that holds, may propose a code change; without the shared rules
- packages/manage/src/retro.ts: the retro prompt's `### Corrections`, grouped by first sentence, for this project's jobs since the last retro's commit
- packages/manage/test/repeats.test.ts: the Repeats section is now followed by Corrections
- packages/manage/test/retro.test.ts: the verify criteria name; a corrections test (grouping, order, other project, unknown job, non-text, 200-character cut, a later last retro)
- packages/orchestration/roles/coordinator.md: spawn and merge lines without restated refusals; the uncommitted-ticket line removed
- packages/orchestration/roles/plan-reviewer.md: without the shared rules
- packages/orchestration/roles/planner.md: without the shared rules
- packages/projects/docs/commands/init.md: init writes verify.md from the core's skeleton
- packages/projects/roles/onboarding.md: who reads verify.md and how to draft it; without the shared rules
- packages/projects/test/init.test.ts: init writes the core's verify skeleton and lists verify.md
- packages/projects/test/onboarding.test.ts: the drafted criteria list includes verify.md
- test/arthur-criteria.test.ts: Arthur's loaded roles read verify too
- test/outside-text.test.ts: every job's spawned prompt holds the rule and the two ending rules once; no job role file does; the coordinator keeps its own
- test/structure.test.ts: line budgets core 7158, delivery 2085, manage 1355

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1447/1518 passed.

## Left open

- Deferred (client summary): F1. run-checks line now only in verify.md
