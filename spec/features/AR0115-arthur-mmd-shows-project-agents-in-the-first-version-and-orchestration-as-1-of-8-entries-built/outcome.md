# AR0115 - Outcome

- Merged: 2026-10-18, `7af750c`
- Branch: h/2026-10-18-ar0115-diagram-counts-c17863d0
- Reviews: review-1.md PASS
- Cost: worker $0.00, reviews $0.30; review rounds 1

## What went in

- `arthur.mmd` and its copy in `README.md`: project agents moved to the front of the later plugins; orchestration shows 3 of 8 entries (23, 24, 26).
- `README.md` feature table: the orchestration row lists 23, 24 and 26 as built.
- GitHub CI on the branch: ci and site passed. The first merge attempt failed one flaky inbox test on main (384/385); three reruns passed 385/385.

## Checks on main

- `npm run check`: passed.
- `npm test`: 385/385 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0114 takes F1 (AR0117 dropped as duplicate).
