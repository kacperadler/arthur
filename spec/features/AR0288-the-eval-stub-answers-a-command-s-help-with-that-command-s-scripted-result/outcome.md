# AR0288 - Outcome

- Merged: 2026-10-22, `3b718b5`
- Branch: h/2026-10-22-ar0288-677493d2
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.54, reviews $1.42; review rounds 2

## What went in

- `packages/develop/src/eval-stub.ts`: every help call in an eval is answered as the live `arthur` CLI answers it: a registered command's page (exit 0), `unknown command` with the list for an unregistered one (exit 2), the usage error for `help a b`, the usage and list for bare `help`/`--help`; it is logged as help and never scored by `calls` or `never`, and never reaches a scenario's scripted answers.
- `packages/develop/docs/commands/eval.md`: describes those answers.
- `test/structure.test.ts`: develop budget 633.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1016/1016 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0293 (F1).
