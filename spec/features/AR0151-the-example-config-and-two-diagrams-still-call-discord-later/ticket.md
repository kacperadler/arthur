# AR0151 - The example config and two diagrams still call Discord later

```json
{
  "id": "AR0151",
  "title": "The example config and two diagrams still call Discord later",
  "date": "2026-10-18"
}
```

## Description

AR0134 moves Discord (roadmap 89, 90) into the first version and adds the owner's own apps over Tailscale (roadmap 95) in `spec/roadmap.md`, `spec/vision.md`, `README.md` and `arthur.mmd`; its Scope names only those four files, so these three still show Discord as a later plugin and have no node for the own apps. `spec/vision.md:3` and `README.md` link the two diagrams.

## Goal

Every place that describes channels says Discord is in the first version, so the example config and diagrams match the roadmap.

- Kind: cleanup

Evidence:
- `arthur.config.example.ts:27` (`// later, named`), `docs/architecture/core-and-plugins.mmd:93` (`discord` in the `later` class), `docs/architecture/versions.mmd:20-25,33` (discord in the later chain `agents --> signal --> discord --> slack`).
- Found by: 2026-10-18-ar0134-d1d258df (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: mark `discord` first in the example config's import comment, move it to the `first` class in `core-and-plugins.mmd`, take it out of the later chain in `versions.mmd` (signal, slack, whatsapp, server) and add the own apps after server. No code changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- mark `discord` first in the example config's import comment, move it to the `first` class in `core-and-plugins.mmd`, take it out of the later chain in `versions.mmd` (signal, slack, whatsapp, server) and add the own apps after server. No code changes.

## Decisions

- 2026-10-18: Source: F1 of AR0134
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
