# AR0031 - `arthur config check` passes a plugin list the host refuses

```json
{
  "id": "AR0031",
  "title": "`arthur config check` passes a plugin list the host refuses",
  "date": "2026-10-16",
  "after": [
    "AR0011"
  ]
}
```

## Description

`config check` runs only the env check, not the host's checks of `packages/core/src/host.ts` (`orchestration` required, `requires`, cycles, duplicate names, each plugin's own `check`). Reproduced: a config whose only plugin is `{ name: "telegram", options: {} }` prints `no enabled plugin names an env variable` and exits 0, while `loadPlugins` refuses it for the missing `orchestration`.

## Goal

`arthur config check` refuses every config the host would refuse at start (missing orchestration, cycles, duplicates, a plugin's own option errors), so a check that says ok means Arthur starts.

- Kind: feat

Evidence:
- `packages/core/src/config-check.ts:6`
- Found by: 2026-10-16-ar0007-ar0007-roadmap-4-53516d96 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: once `arthur run` (entry 8) loads plugins, have `config check` also report the host's refusals without running any `setup` (split the checking part of `loadPlugins` from the setup loop); the env lines stay as they are.
- `npm test` and `npm run check` pass.

## Scope

In:
- once `arthur run` (entry 8) loads plugins, have `config check` also report the host's refusals without running any `setup` (split the checking part of `loadPlugins` from the setup loop); the env lines stay as they are.

## Decisions

- 2026-10-16: Source: F1 of AR0007
