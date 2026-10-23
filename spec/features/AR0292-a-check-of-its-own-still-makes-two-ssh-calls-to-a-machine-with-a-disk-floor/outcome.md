# AR0292 - Outcome

- Merged: 2026-10-22, `59b78a4`
- Branch: h/2026-10-22-ar0292-fdcf5f74
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.48, reviews $1.25; review rounds 2

## What went in

- `packages/resources/src/machine-free.ts`: `ask` runs `node -e` and df in one `sh -c` over one ssh call for a check of its own, in a round's format; `measure` only reads the answer, or uses `os` on `local`.
- `packages/resources/src/machine-disk.ts`: exports the df loop as `DF`.
- `packages/resources/docs/resources.md`: a check of its own costs one ssh call too. Budget resources 616.
- `packages/resources/test/disk.test.ts`: one ssh call per check of its own, with numbers, under the floor, df failing, a missing home, `node` not found.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1031/1031 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
