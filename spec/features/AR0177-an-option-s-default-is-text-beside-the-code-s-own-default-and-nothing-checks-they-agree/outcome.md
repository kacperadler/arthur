# AR0177 - Outcome

- Merged: 2026-10-19, `41a59ad`
- Branch: h/2026-10-19-ar0177-options-doctor-ba-804540bb
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $9.28, reviews $2.60; review rounds 2

## What went in

- Each package with value defaults has a test comparing its option table's defaults with the value its code applies (AR0177).
- `arthur doctor` and `arthur setup` check each plugin's own requirements while the load refuses, so a first setup shows more at once; machines, projects, models and nvm still need their setup (AR0180, F1).
- Roadmap entry 97: decision classes pre-approved from the decision log, on the owner's approval (AR0176).
- The commit-rules doc shows the regex that counts 72 with the prefix (AR0215).

## Checks on main

- `npm run check`: passed.
- `npm test`: 728/728 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
