# AR0255 - Outcome

- Merged: 2026-10-21, `c0548af`
- Branch: h/2026-10-21-ar0255-clock-skew-margin-7420eaea
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.52, reviews $0.85; review rounds 2

## What went in

- The github poll's time (`polled`) is GitHub's `date` header of the list answer minus how long that answer took, rounded down to the second, so this machine's clock running ahead or behind never loses a review; without the header it falls back to this machine's clock. Budget github 625.

## Checks on main

- `npm run check`: passed.
- `npm test`: 941/941 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
