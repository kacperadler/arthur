# AR0267 - Outcome

- Merged: 2026-10-21, `e82d8fd`
- Branch: h/2026-10-21-ar0267-after-merge-findi-432dbb51
- Reviews: review-1.md PASS
- Cost: worker $0.91, reviews $0.53; review rounds 1

## What went in

- The after-merge procedure settles review notes in the project's findings mode (`summary`: deferred, listed under Left open; `grouped`: into the merge's findings ticket; `ticket`: one each); when the merge shows no mode, from `findings({ mode })` in `arthur.config.ts`, else `ticket`. A test runs a real merge in each mode.

## Checks on main

- `npm run check`: passed.
- `npm test`: 944/944 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
