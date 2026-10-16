# AR0007 - Outcome

- Merged: 2026-10-16, `287f0c7`
- Branch: h/2026-10-16-ar0007-ar0007-roadmap-4-53516d96
- Reviews: review-1.md PASS
- Cost: worker $2.59, reviews $0.52; review rounds 1

## What went in

- `packages/core/src/plugin.ts`: the plugin shape `{ name, options?, requires?, check?, setup, start?, stop? }` and what a plugin gets: its name, options, env, folder, and `provide` / `call` / `collect`.
- `packages/core/src/host.ts`: `loadPlugins(config, shell)`: refusals naming the plugins (missing or disabled orchestration, duplicates, missing or disabled required plugin, `requires` cycles, a plugin's own option errors, a throwing setup), setup in dependency order.
- `@arthur/core/testing`: the fake host and the test safety net.
- Tests for each refusal and edge case.

## Checks on main

- `npm run check`: passed.
- `npm test`: 66/66 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0031 (F1).
