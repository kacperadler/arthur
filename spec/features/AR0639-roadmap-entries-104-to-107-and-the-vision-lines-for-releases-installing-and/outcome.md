# AR0639 - Outcome

- Merged: 2026-11-06, `e86e09fc`
- Branch: arthur/2026-11-06-worker-d03737be
- Reviews: review-1.md PASS
- Cost: worker $1.53, reviews $0.38; review rounds 1

## What went in

- spec/roadmap.md: has the Releases section with entries 104 to 107 (versions; the release workflow and changelog per release; installing a release, `arthur update` and `arthur machines update`; the new-release notice), each pointing to its section of the AR0128 plan; a header paragraph on their order and numbering; and entry 30's machine doctor fix now names `arthur machines update` instead of `npm i -g arthur`.
- spec/vision.md: "How it is built" says Arthur has one version for the core and every plugin, released as a Git tag and a GitHub release, not on npm, first release 0.1.0, installed from a clone at the newest tag, updated with `arthur update`, and machines brought to the same version with `arthur machines update`.
- spec/features/AR0639-roadmap-entries-104-to-107-and-the-vision-lines-for-releases-installing-and/findings.md: new file holding F1, the core comment that still describes an install from npm.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1512/1583 passed.

## Left open

- Deferred (client summary): F1. A core comment still describes an install from npm
