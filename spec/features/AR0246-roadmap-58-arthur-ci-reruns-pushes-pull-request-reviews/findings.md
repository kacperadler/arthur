# AR0246 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. A branch `arthur review-needed` waves through is never pushed, so CI never builds it before its merge

- Kind: risk
- Found by: 2026-10-21-ar0246-roadmap-58-github-56fccda8 (worker), 2026-10-21
- Where: `packages/delivery/src/review-needed.ts`, `packages/delivery/src/delivery.ts` (the `job-ended` handler)
- What: entry 58 pushes "the reviewed branch": delivery asks `github.push` after a review's `PASS` only. `arthur merge` counts `no review` from `arthur review-needed` as a PASS on the tip, but that answer pushes nothing, so such a branch has no CI run of its own; entry 59's `arthur merge --auto` (CI passed on the branch) would then wait on a run that never comes, or count main's run the branch started from [INFERENCE: from the nearest-run rule; entry 59 is not built].
- Suggestion: ask `github.push` for the branch when `arthur review-needed` answers `no review`, as after a PASS, with its test; decide with entry 59.
- Status: open

## F2. The vision still says `ci-finished` is keyed by run id

- Kind: cleanup
- Found by: 2026-10-21-ar0246-roadmap-58-github-56fccda8 (worker), 2026-10-21
- Where: `spec/vision.md:109` ("GitHub without webhooks")
- What: AR0238 keys what is told by `<run id>/<run_attempt>`, and roadmap entry 57 now says "once per run attempt"; the vision, which is the owner's, still says "emits `ci-finished` once per run, keyed by run id".
- Suggestion: the owner rewords that sentence to "once per run attempt (a rerun keeps the run's id)".
- Status: open

## F3. A pull request closed and reopened has its reviews told again

- Kind: bug
- Found by: 2026-10-21-ar0246-roadmap-58-github-56fccda8 (worker), 2026-10-21
- Where: `packages/github/src/github-pulls.ts` (`newReviews`), `packages/github/src/github-state.ts`
- What: the state keeps only the open pull requests; one that is closed drops out, and when it is reopened every review it has is new to the state, so each is emitted as `pull-request-review` and wakes the coordinator again. Documented in `packages/github/docs/github.md`, "Pull request reviews".
- Suggestion: tell a review of a pull request new to the state only when it was submitted after the project's previous poll (keep that time in the state), with a test that reopens one.
- Status: open
