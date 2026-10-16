# AR0057 - The vision and the architecture diagrams do not name the voice plugin or the channels' parts

```json
{
  "id": "AR0057",
  "title": "The vision and the architecture diagrams do not name the voice plugin or the channels' parts",
  "date": "2026-10-16"
}
```

## Description

roadmap entry 81 adds a first-version plugin `voice`, and entry 49 makes every channel only receive and emit typed `parts`; the vision's plugin table, its line on the channels' one interface, and both diagrams still list the plugins and the channel interface as before. AR0055's Scope names only `spec/roadmap.md` and `arthur.config.example.ts`.

## Goal

The vision and the diagrams describe the plugins the roadmap plans: the `voice` plugin and the channels' typed parts.

- Model: haiku
- Kind: cleanup

Evidence:
- `spec/vision.md:73` (plugin table), `spec/vision.md:163` (channels share one interface: receive text, send text, send media), `docs/architecture/versions.mmd:8`, `docs/architecture/core-and-plugins.mmd:81`
- Found by: 2026-10-16-ar0055-media-parts-and-v-0c085301 (worker), 2026-10-16

## Done means

- `spec/vision.md`: `voice` in the plugin table (what it owns: local transcription of voice parts with whisper.cpp), and one line that a channel hands a message's typed parts to plugins (entry 49).
- `docs/architecture/*.mmd`: a `voice` node next to the channels, and the parts flowing from a channel to the plugins that claim them; both files still render with `mmdc`.
- Entry 81's three "not transcribed" lines write the path the same way as the transcript line, `(<path>)`.
- `npm test` and `npm run check` pass. English only.

## Scope

In:
- `spec/vision.md`, `docs/architecture/*.mmd`, `spec/roadmap.md` entry 81.

## Decisions

- 2026-10-16: Source: F1 of AR0055
