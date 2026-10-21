# AR0259 - Outcome

- Merged: 2026-10-21, `6d9aaf1`
- Branch: h/2026-10-21-ar0259-example-config-d533ec70
- Reviews: none
- Cost: worker $0.54, reviews $0.00; review rounds 0

## What went in

- `arthur.config.example.ts`: `delivery({...})` no longer gives the refused `merge` option (auto-merge is per project with `autoMerge`); its `review.alwaysReview` adds `**/github-ci.ts` and `**/auto-merge.ts`.
- A test loads the example's delivery options and finds no refusal, with the four CI-failure files always reviewed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 930/930 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
