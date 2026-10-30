# AR0581 - Review 2

- Job: 2026-10-30-review-c9bc45b2
- Branch: arthur/2026-10-30-worker-f5583304
- Commit reviewed: 2587bf454a01f46d41a269a4357e65d2ea35b8c2
- Verdict: PASS

## Final message

Round 2 fixes review 1's finding: the fake job now has `created_at`, and `github-shapes.json` adds exactly the keys GitHub's pinned schema requires. All checks pass, and I found nothing that blocks the merge.

## Findings

None.

## How I judged the fix (`2587bf45`)

- **The pinned description:** I downloaded GitHub's description at `c66e2980…/api.github.com.json`. Its sha256 is `b81f0980…`, the same file the worker used.
- **The shapes file, checked independently:** I wrote my own script, separate from the worker's generator. For each recorded example it found the response schema that cites it and walked the example's keys at every depth, following `$ref` and `allOf`. It listed each property the schema requires that the example leaves out. Its result has the same 7 paths as the worker's list:
  - `job-paginated.jobs[].created_at`
  - `labels[].archived_at`, `labels[].archived_by` and `requested_teams[].type`, in both `pull-request-simple-items` and `pull-request`
- **Nothing else added:** comparing the recorded shapes with the examples shows those 7 keys and nothing more. So the file matches its new `how` text: the example's keys, plus the required keys the example leaves out, recorded as `null`.
- **`packages/github/test/fake-github.ts:63`:** the fake job has `created_at: T` again, so its shape is one the schema accepts.
- **`.agents/arthur/criteria/review.md:23`:** the line again says "a fake of an outside service answers in a shape its documentation does not show". It then defines that as the shape test failing, or leaving out a JSON route the fake answers on success. That meets the ticket's Done means ("the shape test passes"), and it answers review 1's note about the dropped clause.
- **Scope:** this round changed only test files, the shape fixture and `review.md`; no `src` file is in the range. That matches the worker's claim that no line budget moved.

## Notes

- The fake answers `labels` and `requested_teams` as empty lists, so the new label and team item keys are recorded but never compared. That is harmless today, and the worker said so.
- Round 1's YouTrack and Telegram coverage limits still stand. They are recorded as F1–F3 in `findings.md` and were judged in review 1.

## Checks run

- **`npm ci`, `npm run check` and `npm test` in one call (1800 s timeout):** `tsc` printed no errors. `npm test` gave tests 1333, pass 1271, fail 0, skipped 62, the same counts the worker reported. Nothing in `limits.test.ts` failed.
- **`node --test packages/*/test/fake-shapes.test.ts`:** all 6 tests passed.
- **Mutation, `created_at` removed from the fake job:** caught; the test fails with `- job-paginated.jobs[0].created_at`. Restored.
- **Mutation, `created_at` removed from `github-shapes.json`:** caught; the test fails with `+ job-paginated.jobs[0].created_at`. Restored.
- **Base versions of `merge-checks.test.ts` and `youtrack.test.ts` with the tip's `tsconfig.json`:** `tsc` gives TS6133 at `merge-checks.test.ts(280,10)` and `youtrack.test.ts(859,144)`; the tip is clean. Restored.
- **`git status`:** clean after all of the above. The temporary folder `/tmp/rev-c9bc45b2` is removed.

PASS