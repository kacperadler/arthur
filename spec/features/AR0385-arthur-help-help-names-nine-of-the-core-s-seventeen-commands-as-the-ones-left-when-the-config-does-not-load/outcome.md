# AR0385 - Outcome

- Merged: 2026-10-25, `bd4169d0`
- Branch: h/2026-10-25-ar0385-help-fallback-lis-e06c87f9
- Reviews: none
- Cost: worker $1.05, reviews $0.00; review rounds 0

## What went in

- `packages/core/docs/commands/help.md`: `arthur help --help` names all 17 core commands left when the config does not load, in the CLI's order, and says which run as usual (`config`, `help`, `remote-job`, `setup`, `version`) and which refuse with exit 1.
- `packages/core/test/cli.test.ts`: a test that checks the page's list against `arthur help` and `CORE_LIST`, and runs each command without a config to match the page's split.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1097/1097 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/40156406654

## Left open

- Findings: none; no findings.md on this ticket.
