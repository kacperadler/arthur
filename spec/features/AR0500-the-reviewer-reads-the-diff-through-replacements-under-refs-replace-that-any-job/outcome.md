# AR0500 - Outcome

- Merged: 2026-11-05, `875ef073`
- Branch: arthur/2026-11-05-worker-05dc41dc
- Reviews: none
- Cost: worker $0.90, reviews $0.00; review rounds 0

## What went in

- packages/delivery/test/review.test.ts: a test where a review job's own program replaces the reviewed tip under `refs/replace` and sets `core.useReplaceRefs true`. It checks that the task's `git diff` and `git log` still show the real commit, and that without `GIT_NO_REPLACE_OBJECTS` the same commands show the fake one.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1486/1557 passed.

## Left open

- Findings: none; no findings.md on this ticket.
