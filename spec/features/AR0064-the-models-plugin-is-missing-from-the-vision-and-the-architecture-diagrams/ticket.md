# AR0064 - The `models` plugin is missing from the vision and the architecture diagrams

```json
{
  "id": "AR0064",
  "title": "The `models` plugin is missing from the vision and the architecture diagrams",
  "date": "2026-10-16"
}
```

## Description

roadmap entry 82 and `arthur.config.example.ts` add a `models` plugin (marked `first, named`), but the vision's plugin table and both diagrams list every plugin except it; voice (81) was added to all three. This ticket's Scope names only the roadmap and the example config.

## Goal

The vision and the diagrams describe the plugins the roadmap plans: the `models` plugin (entry 82).

- Model: haiku
- Kind: cleanup

Evidence:
- `spec/vision.md:74`, `docs/architecture/versions.mmd:9`, `docs/architecture/core-and-plugins.mmd:15`
- Found by: 2026-10-16-ar0063-providers-and-fal-c8dd47f8 (worker), 2026-10-16

## Done means

- `spec/vision.md`: a `models (named) | first` row in the plugin table: model providers on other machines (Ollama or OpenAI-compatible, loopback, private or Tailscale only) and each role's ordered model list, the first available at spawn.
- `docs/architecture/core-and-plugins.mmd` and `versions.mmd`: a `models` node beside `machines`, in the first version; both still render with `mmdc`.
- `npm test` and `npm run check` pass. English only.

## Scope

In:
- `spec/vision.md`, `docs/architecture/*.mmd`.

## Decisions

- 2026-10-16: Source: F1 of AR0063
