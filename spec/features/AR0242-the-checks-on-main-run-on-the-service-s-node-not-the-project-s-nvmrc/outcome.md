# AR0242 - Outcome

- Merged: 2026-10-21, `a81486a`
- Branch: h/2026-10-21-ar0242-merge-checks-use-d43ff86c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.86, reviews $1.46; review rounds 2

## What went in

- New provided name `nvm.path` (`{ root }` to the PATH with the `.nvmrc` Node first, `""` without one); `arthur merge` asks it before the install and checks on main and again before the reinstall after a reset. An unavailable Node fails the `node` step, runs nothing and resets main; without the nvm plugin the PATH stays as it is. Recorded in `docs/plugin-api.md`; budgets nvm 96, delivery 786.

## Checks on main

- `npm run check`: passed.
- `npm test`: 870/870 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
