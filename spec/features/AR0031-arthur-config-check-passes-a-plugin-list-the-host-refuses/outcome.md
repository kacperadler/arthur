# AR0031 - Outcome

- Merged: 2026-10-16, `19a97a0`
- Branch: h/2026-10-16-ar0031-config-check-host-63e14b42
- Reviews: review-1.md PASS
- Cost: worker $1.09, reviews $0.37; review rounds 1

## What went in

- `packages/core/src/host.ts`: `checkPlugins(config)`, the host's refusals before `setup`, shared by `loadPlugins`, so the two cannot drift.
- `config-check.ts`: prints those refusals before the env lines and exits 1 on any; `ok` needs none.
- Fixtures include `orchestration`; `docs/commands/config.md` lists the refusals.

## Checks on main

- `npm run check`: passed.
- `npm test`: 117/117 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0039 (F1).
