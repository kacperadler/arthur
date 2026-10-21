# AR0257 - Outcome

- Merged: 2026-10-21, `044d050`
- Branch: h/2026-10-21-ar0257-one-wake-per-ci-e-86ffbf6f
- Reviews: review-1.md PASS
- Cost: worker $4.87, reviews $0.99; review rounds 1

## What went in

- A CI run end on a branch `arthur merge --auto` left waiting wakes the coordinator once, with delivery's message: github asks the new provided name `delivery.ciEnded` per branch and leaves such a branch out of its own wake; delivery's minute check only cancels hung runs. A project's first poll still settles a waiting branch whose run had already ended. Budgets delivery 1263, github 630.

## Checks on main

- `npm run check`: passed.
- `npm test`: 946/946 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none open; no ticket made.
