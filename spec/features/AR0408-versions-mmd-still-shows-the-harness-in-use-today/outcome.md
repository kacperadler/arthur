# AR0408 - Outcome

- Merged: 2026-10-25, `da58fccb`
- Branch: arthur/2026-10-25-worker-84970abd
- Reviews: review-1.md PASS
- Cost: worker $0.36, reviews n/a; review rounds 1

## What went in

- `docs/architecture/versions.mmd`: the diagram starts at the switch ("Arthur runs on its own repository, other projects to follow") and its comment says so; the three steps the switch finished (move the modules, start with an empty board, switch Arthur first) are gone with their links; the first-version and later groups are unchanged.
- Review PASS (review-1.md); its one note, the three removed steps beyond the Scope, judged to fit the ticket. Merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1105/1105 passed.

## Left open

- Findings: none; no findings.md on this ticket.
