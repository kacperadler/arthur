# AR0009 - Outcome

- Merged: 2026-10-16, `3e5fc73`
- Branch: h/2026-10-16-ar0009-command-registry-daf148e5
- Reviews: review-1.md PASS
- Cost: worker $2.24, reviews $0.70; review rounds 1

## What went in

- `packages/core/src/commands.ts`: the command registry: `register({ name, doc, run, phone? })` (refuses duplicates naming both plugins, a missing doc file, a bad name), `route(text)` for channels, `phone()` for menus.
- `packages/core/src/cli.ts`: the `arthur` binary over the registry; `arthur config check` still works.
- `host.commands` for plugins; the fake host uses the real registry.

## Checks on main

- `npm run check`: passed.
- `npm test`: 83/83 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0032 (F1), AR0033 (F2).
