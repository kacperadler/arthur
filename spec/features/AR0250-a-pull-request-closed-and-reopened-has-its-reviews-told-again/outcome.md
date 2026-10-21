# AR0250 - Outcome

- Merged: 2026-10-21, `bad0ec0`
- Branch: h/2026-10-21-ar0250-reopened-pr-revie-8bb4c889
- Reviews: review-1.md PASS
- Cost: worker $2.29, reviews $0.53; review rounds 1

## What went in

- The github state keeps, per project, when its last review poll began (`polled`); a pull request new to the state (opened, reopened, back in the list) has only reviews submitted since then told, a review with no `submitted_at` is told. An old state file tells nothing on its next poll.
- Test that closes and reopens a pull request, also across a restart. Budget github 595.

## Checks on main

- `npm run check`: passed.
- `npm test`: 881/881 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0255 (F1).
