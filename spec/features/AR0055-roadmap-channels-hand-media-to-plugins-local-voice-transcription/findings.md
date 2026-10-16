# AR0055 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The vision and the architecture diagrams do not name the voice plugin or the channels' parts

- Kind: cleanup
- Found by: 2026-10-16-ar0055-media-parts-and-v-0c085301 (worker), 2026-10-16
- Where: `spec/vision.md:73` (plugin table), `spec/vision.md:163` (channels share one interface: receive text, send text, send media), `docs/architecture/versions.mmd:8`, `docs/architecture/core-and-plugins.mmd:81`
- What: roadmap entry 81 adds a first-version plugin `voice`, and entry 49 makes every channel only receive and emit typed `parts`; the vision's plugin table, its line on the channels' one interface, and both diagrams still list the plugins and the channel interface as before. AR0055's Scope names only `spec/roadmap.md` and `arthur.config.example.ts`.
- Suggestion: add a `voice (named) | first | ...` row to the vision's table and to the first-version box and class lists of the two diagrams; say in the vision that a channel emits typed parts and media plugins handle them. Nothing else changes.
- Status: open

## F2. The styleguide forbids a plugin to read another plugin's folder, and voice reads the channel's saved file

- Kind: risk
- Found by: 2026-10-16-ar0055-media-parts-and-v-0c085301 (worker), 2026-10-16
- Where: `.agents/harness/criteria/styleguide.md` ("Each plugin keeps its own state in its own folder under `.arthur/`; it does not read or write another plugin's folder."), `spec/roadmap.md` entry 81
- What: AR0055 requires the channel to save files under `.arthur/<channel>/` and the voice plugin to convert that audio. Entry 81 words it as "reads only the file the part names", but a reviewer of the voice ticket can read the styleguide's rule as forbidding it.
- Suggestion: one clause in the styleguide: a plugin may read a file another plugin hands it by path through the host (a message part), never list or write that folder.
- Status: open
