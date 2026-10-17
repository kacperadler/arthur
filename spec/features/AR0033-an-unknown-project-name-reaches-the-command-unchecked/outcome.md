# AR0033 - Outcome

- Merged: 2026-10-17, `2f47a42`
- Branch: h/2026-10-17-ar0033-9e57db69
- Reviews: review-1.md PASS
- Cost: worker $1.20, reviews $0.45; review rounds 1

## What went in

- `packages/core/src/cli.ts`: `main` checks a `--project` name against the known projects before the command runs; an unknown one prints `arthur <cmd>: unknown project <name>; projects: <names>` and exits 1.
- `packages/core/src/job-checkout.ts`: `knownProject` holds the project lookup that `checkout`, `arthur spawn` and `arthur roles` share; outside Git with no project list it refuses any name.
- `packages/core/src/host.ts`: `loadPlugins` returns `project(name)`, that lookup on the config's folder and project list.
- `help.md`: the refusals and the unchecked case of a config that does not load.

## Checks on main

- `npm run check`: passed.
- `npm test`: 331/331 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
