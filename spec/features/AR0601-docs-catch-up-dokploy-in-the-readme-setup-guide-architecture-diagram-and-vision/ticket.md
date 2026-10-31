# AR0601 - Docs catch up: Dokploy in the README, setup guide, architecture diagram and vision; the roadmap and arthur.mmd lines left stale

```json
{
  "id": "AR0601",
  "title": "Docs catch up: Dokploy in the README, setup guide, architecture diagram and vision; the roadmap and arthur.mmd lines left stale",
  "date": "2026-10-31"
}
```

## Description

The merges of 2026-10-31 updated each plugin's own docs, but some shared pages still say the old thing. After this ticket the README, the setup guide, the architecture diagrams and the vision name the dokploy plugin as Discord's merge did for Discord, and the roadmap and `arthur.mmd` lines the findings named say what is built now.

## Goal

Evidence, on main at afe77a18:

- `grep -ci dokploy README.md docs/setup.md docs/architecture/core-and-plugins.mmd spec/vision.md` prints 0 for each, though AR0588 (dokploy T1, merged e4a950b0) added `packages/dokploy`. AR0592's merge (Discord T1) touched README.md, docs/setup.md and both diagrams for Discord; AR0588's touched only `packages/dokploy/docs/`.
- AR0495 F1 (its outcome.md): roadmap entry 1 still says a source file has at most 200 lines, where the styleguide now has three zones.
- AR0592 F1 (its outcome.md): `arthur.mmd` still shows stale status lines.

- Kind: docs

## Done means

- README.md, docs/setup.md, docs/architecture/core-and-plugins.mmd, docs/architecture/versions.mmd and spec/vision.md name dokploy where they name the other first-version plugins, with what it does and where its setup lives (`packages/dokploy/docs/dokploy.md`).
- Roadmap entry 1 states the three zones as the styleguide does.
- `arthur.mmd`'s status lines match the board for the tickets AR0592 F1 names.
- `npm run check` and `npm test` pass (the docs and option-table tests included).

## Scope

In:
- README.md, docs/setup.md, docs/architecture/core-and-plugins.mmd, docs/architecture/versions.mmd, spec/vision.md, spec/roadmap.md, the `arthur.mmd` AR0592 F1 names.

## Decisions
- 2026-10-31: Approve AR0601 and start it; the silent work stops at 80% weekly usage or when the current tickets are done; the owner: "Set limit to 80% and go till current tasks are done, AR601 start" (AR-D419)
