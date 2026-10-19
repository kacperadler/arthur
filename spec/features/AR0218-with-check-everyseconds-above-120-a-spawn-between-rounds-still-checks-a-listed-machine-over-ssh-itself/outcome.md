# AR0218 - Outcome

- Merged: 2026-10-19, `e0c0a28`
- Branch: h/2026-10-19-ar0218-small-pair-2117a1a3
- Reviews: review-1.md PASS
- Cost: worker $3.56, reviews $1.00; review rounds 1

## What went in

- A machines round passes its `check.everySeconds`; resources keeps it in the machine's sample file, and a round's sample stands until twice that value, across processes; resources' own check still lasts 120 s, a bad value rechecks (AR0218).
- `schedule.register` takes the registering plugin's own `host.package`, not a lookup by name (AR0219).

## Checks on main

- `npm run check`: passed.
- `npm test`: 738/738 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
