# AR0151 - Outcome

- Merged: 2026-10-19, `e373e84`
- Branch: h/2026-10-19-ar0151-docs-doctor-batch-1ae178d5
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.97, reviews $1.87; review rounds 2

## What went in

- The example config and the diagrams (`core-and-plugins.mmd`, `versions.mmd`) show Discord in the first version, next to Telegram (AR0151).
- Roadmap entries 93 and 94 sit after 41, the project list they read (AR0152).
- `arthur doctor` checks the tools in `local.labels.tools` on this machine (AR0172).
- `arthur init` writes the criteria skeleton of every registered role (AR0186).
- The example's commit regex counts the whole subject, at most 72 characters (AR0200).

## Checks on main

- `npm run check`: passed.
- `npm test`: 703/703 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
