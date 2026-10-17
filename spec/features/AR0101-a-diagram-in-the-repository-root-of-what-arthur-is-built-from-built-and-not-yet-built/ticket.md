# AR0101 - A diagram in the repository root of what Arthur is built from, built and not yet built

```json
{
  "id": "AR0101",
  "title": "A diagram in the repository root of what Arthur is built from, built and not yet built",
  "date": "2026-10-17"
}
```

## Description

The owner asked (2026-10-17, Telegram) for one clear, good-looking Mermaid diagram in the repository's root folder, in the style of `docs/architecture/core-and-plugins.mmd`: Arthur's whole structure, where the core is, the modules and plugins, what connects to what, and which parts exist today (green) and which do not yet (grey).

## Goal

The owner sees Arthur's shape and progress on one picture without reading code.

- Kind: improvement

## Done means

- `arthur.mmd` in the repository root: one `flowchart`, grouped in subgraphs (the core and its parts; the first-version plugins; the later plugins; the outside world: the human, channels, GitHub, other machines over SSH), arrows for what calls or feeds what, plugins talking only through the core as the vision says.
- Every box's status read from the code on main and `spec/build.json`, not guessed: built (merged, present in `packages/`) is green; planned is grey and dashed; a part partly built (some roadmap entries merged) is marked in its label (e.g. `3 of 5 entries`). A legend in the diagram says what green, grey and dashed mean, and the date of the state shown.
- Laid out to read well: grouped top to bottom (human and channels, core, plugins, outside), no crossing tangle where a subgraph order avoids it, labels of at most three short lines.
- Rendered to check it: `npx -y @mermaid-js/mermaid-cli -i arthur.mmd -o <job folder>/arthur.png -w 1600` succeeds (Chrome is installed on this host), and the worker looks at the PNG with its `read` tool and fixes what reads badly. The PNG is not committed; its path is named in the final message, and a viewport-high slice of it (at most about 1600 px tall each) if the whole is taller.
- `README.md` links `arthur.mmd` in one line.
- Nothing names a client or another of the owner's projects (Arthur's standing rule).
- `npm test` and `npm run check` pass.

## Scope

In:
- `arthur.mmd`, one line in `README.md`.

Out:
- The diagrams in `docs/architecture/`; code.

## Decisions

- 2026-10-17: The owner asked for it while Arthur's build is paused; a diagram is not build work, so it runs now.
- 2026-10-17: The owner: the diagram itself goes in README.md, so GitHub shows it on the repository page (it renders a ```mermaid block natively; an SVG from mermaid-cli cut labels off on his phone). arthur.mmd stays the source; a test fails when the README block differs from it.
