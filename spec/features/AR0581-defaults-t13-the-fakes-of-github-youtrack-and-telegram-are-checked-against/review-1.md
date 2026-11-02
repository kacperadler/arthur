# AR0581 - Review 1

- Job: 2026-10-30-review-17c4c2c2
- Branch: arthur/2026-10-30-worker-f5583304
- Commit reviewed: bee8fc1708f392aa2fe1aab37304951440c93738
- Verdict: FAIL

## Final message

The branch fails on one finding. The GitHub fake now leaves out a key that GitHub's own schema requires on every job, and the new shape test refuses to let it be put back.

## Findings

1. **`packages/github/test/fake-github.ts:63`: the fake job no longer has `created_at`, which GitHub requires on every job, and `packages/github/test/github-shapes.json` now blocks putting it back.**
   - I downloaded the pinned description (`c66e2980…/api.github.com.json`). `components.schemas.job.required` includes `created_at`, so real GitHub sends it on every job. The `job-paginated` example simply leaves it out of its sample.
   - `github-shapes.json` records only the example keys, as its own `how` field says. So the fake was trimmed to match an outdated sample and now answers a job the schema calls invalid.
   - That is a fail under the review criteria the reviewer is bound by ("a fake of an outside service answers in a shape its documentation does not show"). It also goes against the styleguide's "every field included" and against P18's aim of catching fakes that drift from the real service.
   - Mutation: putting `created_at: T` back in `shapedJob` makes `fake-shapes.test.ts` fail with `+ job-paginated.jobs[0].created_at`. The test punishes the fake for being correct.
   - The worker's message says only "GitHub's own examples leave them out, though its schema has them". It never says one of the keys is required.
   - Fix: record each shape as the example keys plus the schema's required properties, and keep `created_at` on the fake job.
   - Does it hide real behaviour? Not today: `packages/github/src` never reads a job's `created_at` or `run_attempt` (`github-ci.ts:99-108` reads `id`, `conclusion`, `steps`, `name`).

## How I judged each change outside the Scope list

- **GitHub run: `referenced_workflows` and `previous_attempt_url` removed.** Both are optional in the `workflow-run` schema, so the shape is still valid. The plugin doesn't read them: `github-api.ts:110` reads `run_attempt` and `run_started_at`/`created_at`, which the run keeps.
- **GitHub job: `run_attempt` removed.** Optional in the schema, so valid. `created_at` is the one that breaks (finding 1).
- **GitHub pull request and run repository keys added** (`git_url`, `ssh_url`, …). These match the examples and hide nothing.
- **Telegram Video gains `width`, `height`, `duration`.** These are required fields. `media-in.ts:64` reads `duration`, so the fake now also feeds that real code path.
- **YouTrack bundle `$type` set to `EnumBundle`/`StateBundle`, and `thumbnailURL` removed from article attachments.** The plugin reads neither (no match under `packages/youtrack/src`), so nothing is hidden.
- **The YouTrack fake moved to `fake-youtrack.ts`.** The commit that moves it (`122142e1`) only adds `export` and a header comment: I diffed the removed block against the new file. The later behaviour change is separate (`7836ff11`). Test files have no 200-line cap (`structure.test.ts` checks `src` only), so its 259 lines are fine.
- **Which removed keys fail a test.**
  - GitHub fails on any removed key, as the ticket asks.
  - Telegram fails only on keys the docs require. Real answers leave Optional fields out, so a fake without one still has a documented shape.
  - YouTrack fails only on keys the plugin asks for, plus `$type`. YouTrack answers only the `fields` asked for, so an unasked key is not part of a real answer.
  - Both narrower rules fit the "fails when a key is removed" Done means, and the gap the YouTrack rule leaves is recorded as F2.

## Notes (do not block)

- Two of the test's own guards survived mutation, because they only matter when a fake is broken: the Telegram `body.ok` check (`fake-shapes.test.ts`, telegram) and the YouTrack check that refuses an empty or non-200 answer. The worker said so and tested them by breaking the fake instead.
- Mutations that survived by design, as the worker described: dropping the Optional `username` from Telegram's BOT, and dropping the unasked `textPreview` from YouTrack comments.
- The new `review.md` line drops the old "answers in a shape its documentation does not show" test. Combined with example-only shapes, that is how finding 1 can get through.
- F1–F3 in `findings.md` are useful and stated accurately.

## Checks run

- `npm ci && npm run check && npm test` in one call (1800 s timeout): tsc printed no errors. A second `npm test` to get the summary: tests 1333, pass 1271, fail 0, skipped 62, exit 0. This matches the worker's numbers, and nothing in `limits.test.ts` failed.
- **tsc on the base test files** (`merge-checks.test.ts`, `youtrack.test.ts` from `8c271b51`) with the tip's tsconfig: TS6133 at `merge-checks.test.ts(280,10)` and `youtrack.test.ts(859,144)`. Clean on the tip.
- **Base fakes against the new tests:** the GitHub test fails (`+ …referenced_workflows`, `+ …previous_attempt_url`, `- …repository.git_url`, …) and so does the Telegram one (`- sendVideo.result.video.width`, …). All 6 shape tests pass on the tip.
- **Mutations** (each restored from memory afterwards; `git status` is clean):
  - Caught: GitHub without `runner_name`; GitHub check with its `-` side off; GitHub check with its "not a list" report off; Telegram BOT without `is_bot`; Telegram without `date`; Telegram Video without `width`; Telegram check without the getMe rule; YouTrack comment author without `name`; YouTrack work item without `$type`; YouTrack check with its `+` side off.
  - Survived: Telegram `ok` check off; YouTrack empty-answer check off; Telegram BOT without `username` (by design); YouTrack without `textPreview` (by design).
  - Restoring the schema-required job `created_at`: the test fails (finding 1).
- **Schema check:** in the pinned GitHub description, `job` requires `created_at`, and `run_attempt` is optional. In `workflow-run`, `previous_attempt_url`, `referenced_workflows` and `run_attempt` are optional. The `job-paginated` example has neither `created_at` nor `run_attempt`.

FAIL