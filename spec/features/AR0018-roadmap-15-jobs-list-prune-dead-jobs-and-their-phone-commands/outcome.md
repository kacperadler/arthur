# AR0018 - Outcome

- Merged: 2026-10-16, `58a6aa5`
- Branch: h/2026-10-16-ar0018-jobs-list-prune-d-436045b4
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $7.83, reviews $1.12; review rounds 2

## What went in

- `job-records.ts`: `arthur jobs` and `/jobs` (running, needs attention, done); short ids; `arthur prune [<id>...]` (no `--force`, Git's refusals keep what Git keeps, `jobs.keep`, an unknown id refuses the whole prune first); `arthur stopall` and `/stopall` (`stop-all` first); a sweep every 30 s fails a running job whose wrapper and agent are gone twice in a row; `/steer`.
- Core line budget 4372 (ticket Decisions).

## Checks on main

- `npm run check`: passed.
- `npm test`: 271/271 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0071 (F1).
