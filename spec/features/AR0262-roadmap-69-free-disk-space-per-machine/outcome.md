# AR0262 - Outcome

- Merged: 2026-10-21, `92cfbeb`
- Branch: h/2026-10-21-ar0262-roadmap-69-disk-f-82a16dc2
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $6.58, reviews $1.93; review rounds 2

## What went in

- `keepFree.disk` in resources (default `0`, no floor): at each machine check, `df -Pk` on Arthur's home and each path from `collect("resources.disk", machine)`, locally or over SSH; two paths on one filesystem count once, a missing provider path is skipped with its own line. No job starts on a machine under the floor, the refusal naming machine, path, space and floor; the first check under it emits one `disk-low` and one notice.
- Core: `host.jobs.home(machine)`. Budgets core 5742, resources 577.

## Checks on main

- `npm run check`: passed.
- `npm test`: 929/929 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0269 (F1), AR0270 (F2), AR0271 (F3).
