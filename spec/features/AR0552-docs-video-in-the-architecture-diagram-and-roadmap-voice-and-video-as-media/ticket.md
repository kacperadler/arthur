# AR0552 - Docs: video in the architecture diagram and roadmap, voice and video as media plugins in the README diagram

```json
{
  "id": "AR0552",
  "title": "Docs: video in the architecture diagram and roadmap, voice and video as media plugins in the README diagram",
  "date": "2026-10-28"
}
```

## Description

The docs name the voice and video plugins almost everywhere; three places are still out of date. The owner asked to update them and add what is missing about video (AR-D272).

## Goal

- `docs/architecture/core-and-plugins.mmd` names voice but not video.
- The README's diagram (`README.md:66`) puts voice and video in the `channels` box, though they are media plugins that claim a channel's parts, not channels (AR0551 review note).
- `spec/roadmap.md` has entry 81 for voice and no entry for video.

- Kind: docs

## Done means

- The architecture diagram shows video beside voice, as a plugin that claims `video` parts and asks voice for the words through the host.
- The README diagram shows voice and video as media plugins apart from the channels, with the same links as the README's plugin list.
- The roadmap has an entry for video (built, AR0551), after entry 81, in the shape the other entries use, and the vision's "Where the less obvious parts live" names video where it names voice, if it names voice there.
- `npm run check` and `npm test` pass.

## Scope

In:
- `docs/architecture/core-and-plugins.mmd`, `README.md`, `spec/roadmap.md`, `spec/vision.md`.

Out:
- Any code change.

## Decisions
