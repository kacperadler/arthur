# AR0103 - Outcome

- Merged: 2026-10-17, `a1b3299`
- Branch: h/2026-10-17-ar0103-readme-9e58b7a9
- Reviews: review-1.md PASS
- Cost: worker $1.74, reviews $1.24; review rounds 1

## What went in

- `README.md`: an opening paragraph from the vision; "What Arthur is" and "What Arthur is not"; Status dated 2026-10-17 (core entries 1-22, orchestration 23, projects 41 built; still not usable); a features table marked built, in progress (N of M entries) or planned; one line per command `arthur help` lists; a "Try it" config with the two built plugins; links to the vision, roadmap, board, diagrams, example config, deploy and licence. The diagram section is unchanged.

## Checks on main

- `npm run check`: passed.
- `npm test`: 357/357 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- F1: fixed on main with the board commit (`.arthur/` in `.gitignore`); AR0104 dropped.
