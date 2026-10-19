# AR0167 - Outcome

- Merged: 2026-10-19, `59e5760`
- Branch: h/2026-10-19-ar0167-be6531bc
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $18.03, reviews $2.22; review rounds 2

## What went in

- `packages/core/test/job-state.test.ts`: after a block that stops the run, waits for `job-ended` before asserting it.
- `packages/core/src/job-state.ts` `field`: a record file removed between the existence check and the read reads as empty instead of throwing `ENOENT` (`arthur stop` could throw the same way).
- `packages/core/src/fake-agent.ts` `note`: a notes file is created with its first line by a link, so a reader never sees it empty; `restart.test.ts` waits for the handoff message and its read mark.
- `packages/session/test/start-notice.test.ts`: finds the timed-out probe's agent by its folder (`ps`), not by a pid it may not have noted yet.
- Evidence in `findings.md` ("Tests fixed"): each test, its symptom and how it was found; after the fixes 15 of 15 full runs on 2 cores passed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 548/548 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0171 (F1).
