# AR0270 - vision.md's disk refusal example differs from the roadmap and the code

```json
{
  "id": "AR0270",
  "title": "vision.md's disk refusal example differs from the roadmap and the code",
  "date": "2026-10-21"
}
```

## Description

the vision gives the refusal as `build: 12.3 GB disk free, floor 20 GB`; roadmap entry 69 gives `build: 12.3 GB free on /var/lib/docker, floor 20 GB`, and the plugin says `build: no room, 12.3 GB free on /var/lib/docker, floor 20 GB` (docs/resources.md in the package, "Free disk").

## Goal

The vision, roadmap entry 69 and the plugin give one wording for the disk refusal, the code's, so the owner reads the same message everywhere.

- Kind: cleanup

Evidence:
- `spec/vision.md:160`
- Found by: 2026-10-21-ar0262-roadmap-69-disk-f-82a16dc2 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: align the vision's example with the roadmap's, naming the path. Out: the code.
- `npm test` and `npm run check` pass.

## Scope

In:
- align the vision's example with the roadmap's, naming the path. Out: the code.

## Decisions

- 2026-10-21: Source: F2 of AR0262
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
