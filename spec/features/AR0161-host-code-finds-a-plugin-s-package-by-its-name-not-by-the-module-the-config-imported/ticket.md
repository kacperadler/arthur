# AR0161 - `host.code` finds a plugin's package by its name, not by the module the config imported

```json
{
  "id": "AR0161",
  "title": "`host.code` finds a plugin's package by its name, not by the module the config imported",
  "date": "2026-10-19"
}
```

## Description

the host takes a plugin's package folder as the folder beside the core's named after the plugin (`packages/<name>`, or `node_modules/@arthur/<name>`), when it holds a `package.json`. A plugin the config writes itself under a package's name (the core's tests do this with `orchestration`) gets that package's folder, so the restart guard watches code that is not loaded; a plugin from a package of another name, or installed elsewhere, gets no folder, so its code is not watched. With the workspace's own plugins, each named as its folder, both lists match.

## Goal

The restart guard watches the code the config actually loaded, even when a plugin comes from a module whose name differs from its package.

- Kind: risk

Evidence:
- `packages/core/src/host.ts` (`loadPlugins`, the `code` list)
- Found by: 2026-10-18-ar0153-0044a3b1 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: when entry 51 freezes the plugin API, let a plugin name its own module (`import.meta.url`) and take the folder from that.
- `npm test` and `npm run check` pass.

## Scope

In:
- when entry 51 freezes the plugin API, let a plugin name its own module (`import.meta.url`) and take the folder from that.

## Decisions

- 2026-10-19: Source: F2 of AR0153
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
- 2026-10-19: The owner: close what is open today. Built in the core and orchestration batch hosted by AR0190.
