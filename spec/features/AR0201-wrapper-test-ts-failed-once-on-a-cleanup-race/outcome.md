# AR0201 - Outcome

- Merged: 2026-10-19, `244a725`
- Branch: h/2026-10-19-ar0201-wrapper-flake-ecce772d
- Reviews: review-1.md PASS
- Cost: worker $2.28, reviews $0.52; review rounds 1

## What went in

- The fake agent records its start only after its extensions have loaded and their `session_start` handlers answered, so a test that removes a job's record on that start no longer races the agent's stderr into the record's `log` (`ENOTEMPTY` in `wrapper.test.ts`).
- A new test in `testing.test.ts` fails with the old order and passes with the new one.

## Checks on main

- `npm run check`: passed.
- `npm test`: 645/645 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0202 (F1).
