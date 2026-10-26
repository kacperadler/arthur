# AR0350 - Review 1

- Job: 2026-10-26-review-dd52de48
- Branch: arthur/2026-10-26-worker-a0a21ea4
- Commit reviewed: 4647dc1c8896691157c771d3cfc4b8ec1b7d63d4
- Verdict: PASS

## Final message

No findings block the merge. All eight role files carry the ticket's rule in the same words, each has its own test, and the coordinator explains `[Arthur: github]` and how a CI log goes to a worker.

**Findings**

None.

**Notes (not blocking)**
- The worker widened the ticket's sentence in three ways and explained each in the final message:
  - "this role and the sections after it" also instruct.
  - A repository file counts as binding when the task or the project's sections make it so (an approved plan, or the rules a styleguide points to).
  - "another job's message (in your task too)".

  None of them contradicts a Decision. Without the second, the worker's `Plan:` line would clash with a client styleguide that points to `CLAUDE.md`. For onboarding, which reads `CLAUDE.md` and `AGENTS.md` without such a section, they stay data, which is the intent (`onboarding.md:14`).
- `coordinator.md:14` says the review text "under its first line is the reviewer's". But the first line written at `github.ts:113` also holds outside text: the pull request title, the user login and the branch name. The general rule still covers it as "a review", so the wording is narrower than it should be but not wrong.
- `github.ts:95` still suggests `arthur continue <job> '<the failed step and its lines>'` with no quoting. The worker flagged this, and it is outside the ticket's wording scope.
- The `[Arthur: <plugin>]` mark the role describes matches the code (`hand-over.ts:13`), and both GitHub texts (CI end with `Why:`, pull request review) match `github.ts:96-113`.
- YouTrack is untouched: `packages/youtrack/` is not in the diff, and the coordinator's YouTrack test still passes.
- Placing the test in the root `test/` folder follows existing cross-package tests (`test/arthur-criteria.test.ts`).

**Checks run**
- `npm ci`: 22 packages added.
- `npm run check` (`tsc`): no errors.
- `test/outside-text.test.ts`, `packages/orchestration/test/context.test.ts`, `test/structure.test.ts` and `test/readme.test.ts`: 39 tests, all passed.
- `packages/core/test/roles.test.ts`, `packages/manage/test/retro.test.ts` and `packages/orchestration/test/*.test.ts`: 190 tests, 153 passed, 0 failed, 37 skipped. All 37 skips I looked at (in orchestration) are on `NO_UNIX_SOCKET` or "not run in a job's systemd scope", not on the role text.
- The full `npm test` was not run, as you instructed, so the ticket's "`npm test` passes" point is covered only by these subsets.
- Mutations, each caught; all restored with `git checkout -- packages`, the probe folder removed, `git status --short` empty:
  - Rule line deleted from `planner.md`: its test fails.
  - One phrase changed in `onboarding.md` ("in your task too" to "in your task"): its test fails.
  - The `[Arthur: <plugin>]` line removed from `coordinator.md`: the coordinator test fails.
  - A new `packages/github/roles/x.md` without the rule: both the eight-file test and that file's own test fail.
  - The "For you, the owner's word" line deleted from `coordinator.md`: the coordinator test fails.
  - The rule line added twice to `retro.md`: the once-only check fails.

PASS