# AR0101 - Outcome

- Merged: 2026-10-17, `37081c1`
- Branch: h/2026-10-17-ar0101-diagram-fb43a273
- Reviews: review-1.md PASS
- Cost: worker $5.33, reviews $1.57; review rounds 1

## What went in

- `arthur.mmd` (new, repository root): one Mermaid diagram in three zones under the owner: the core (all 22 entries built, green, with the config file and the terminal), the plugins (first-version groups and later plugins, built green, partly built light green with N of M entries, planned grey and dashed, including AR0098's project agents, discord and slack), and outside Arthur; a dated legend.
- `README.md`: the same diagram in a ```mermaid block, which GitHub draws on the repository page.
- `test/structure.test.ts`: fails when the README block differs from `arthur.mmd`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 357/357 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- F1: folded into AR0098 (AR0102 dropped).
