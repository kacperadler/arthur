# AR0256 - Outcome

- Merged: 2026-10-21, `456975d`
- Branch: h/2026-10-21-ar0256-roadmap-66-plugin-18c71d6b
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $6.54, reviews $1.00; review rounds 2

## What went in

- New `packages/develop` plugin with `arthur plugin new <name> --budget <lines> [--project <name>]`: writes `packages/<name>/` (package.json, a plugin file that is also its options file, a fake-host test, a doc page), the budget in `test/structure.test.ts`, the workspace in `package-lock.json` and its `node_modules` link; the result passes check and test unedited.
- Refusals before any write: a bad or taken name, a reserved or clashing function name, a missing or bad `--budget` or one under the 25 lines written, a checkout that is not Arthur's. Budget develop 198.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 899/899 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0260 (F1).
