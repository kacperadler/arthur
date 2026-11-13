# AR0703 - herdr in the architecture diagrams, and the vision's sweep text to the AR-D520 limit

```json
{
  "id": "AR0703",
  "title": "herdr in the architecture diagrams, and the vision's sweep text to the AR-D520 limit",
  "date": "2026-11-13"
}
```

## Description

The herdr plugin is built and loaded in the owner's config, but none of the three architecture diagrams shows it. The vision says the daily Docker sweep removes unlabelled stopped containers and anonymous volumes, while the owner limited it (AR-D520) to dangling images, unused networks and old build cache. This ticket draws herdr in the diagrams and proposes the vision's new wording for the sweep, which the owner approves since the vision is his.

## Goal

The diagrams and the vision are the map the vision says one person reads to understand Arthur. One plugin the owner runs is missing from it, and the vision promises a sweep the code deliberately does not do.

Evidence:
- `grep -c herdr` gives 0 in `arthur.mmd`, `docs/architecture/core-and-plugins.mmd` and `docs/architecture/versions.mmd`. Yet `packages/herdr` is built, `README.md:57` calls it built, `arthur.config.example.ts:411` lists it, and the owner's config loads it (`import { herdr }`, line 18).
- `spec/vision.md:168`: the sweep removes unlabelled "stopped containers, … unused anonymous volumes". `packages/docker/src/docker-sweep.ts:6-9` and `doom` (`:52-63`) remove only dangling images and unused networks, keeping the owner's stopped containers and volumes (AR-D520).

- Kind: docs

## Done means

- `arthur.mmd`, `docs/architecture/core-and-plugins.mmd` and `docs/architecture/versions.mmd` each have a herdr node, built, next to the other built plugins, with its class line in name order; each diagram still renders.
- The owner is shown, and approves, the new wording of `spec/vision.md:162` and `:168` limited to AR-D520 (for example: "unlabelled leftovers older than `leftoverHours`: unused networks, dangling images, build cache unused that long; the owner's own stopped containers and volumes stay"); only his approved text goes in.

## Scope

In:
- `arthur.mmd`, `docs/architecture/core-and-plugins.mmd`, `docs/architecture/versions.mmd`.
- `spec/vision.md:162` and `:168`, with the owner's approved text.

Out:
- No code.

## Decisions

- 2026-11-13: Source: audit spec/quality/2026-11-13.md
- 2026-11-13: Source: F2 of AR0676
- 2026-11-13: Source: F1 of AR0647
