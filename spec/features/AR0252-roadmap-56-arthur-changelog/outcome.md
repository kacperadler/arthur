# AR0252 - Outcome

- Merged: 2026-10-21, `a5ed83a`
- Branch: h/2026-10-21-ar0252-roadmap-56-change-6b5afa2b
- Reviews: review-1.md PASS
- Cost: worker $3.56, reviews $0.70; review rounds 1

## What went in

- `packages/delivery/src/changelog.ts` (new): `arthur changelog [--project <name>]` writes `CHANGELOG.md` from the merged tickets, one section per merge day, newest first, a heading per kind (feature and improvement Added, bug and risk Fixed, cleanup Changed, else Other), ids by number so two runs agree; no merged ticket writes `No merged ticket yet.`
- `arthur merge` rebuilds it after every merge that went in; `CHANGELOG.md` no longer counts as a dirty main, and the after-merge procedure commits it with the board. Budget delivery 1019.

## Checks on main

- `npm run check`: passed.
- `npm test`: 880/880 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
