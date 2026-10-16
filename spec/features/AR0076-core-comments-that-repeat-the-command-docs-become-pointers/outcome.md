# AR0076 - Outcome

- Merged: 2026-10-16, `50e254e`
- Branch: h/2026-10-16-ar0076-comments-become-p-21697ec8
- Reviews: review-1.md PASS
- Cost: worker $1.09, reviews $0.60; review rounds 1

## What went in

- 14 core files: comments that repeated `docs/commands/` pages became one-line pointers; comments on code details no doc holds kept. Core 4255 -> 4189 lines, no code change.

## Checks on main

- `npm run check`: passed.
- `npm test`: 271/271 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
