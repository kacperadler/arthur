# AR0073 - Outcome

- Merged: 2026-10-16, `76d4505`
- Branch: h/2026-10-16-ar0073-core-dedup-and-co-0a7f996f
- Reviews: review-1.md PASS
- Cost: worker $3.10, reviews $0.97; review rounds 1

## What went in

- A1 to A5 of the core line review: one plugin-entry check, one `describe`, one plugin-step guard, one record reader, `appendEvent` gone. Core 4372 -> 4339 lines; `arthur config check` prints a refused entry once.

## Checks on main

- `npm run check`: passed.
- `npm test`: 272/272 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0081 (F1).
