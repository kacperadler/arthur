# AR0105 - A landing page and docs site for Arthur, built with Astro Starlight

```json
{
  "id": "AR0105",
  "title": "A landing page and docs site for Arthur, built with Astro Starlight",
  "date": "2026-10-17"
}
```

## Description

The owner's idea (2026-10-17, Telegram): a landing page for Arthur with its roadmap, and later its documentation, built on Astro Starlight (https://starlight.astro.build/getting-started/).

## Goal

A public site that shows what Arthur is, its state and its roadmap, kept true by building from the files in the repository (`README.md`, `arthur.mmd`, `spec/roadmap.md`, `spec/build.json`, `packages/*/docs/commands/`), never by a second hand-written copy.

- Kind: improvement
- Plan: tak

## Done means

- A plan, approved by the owner, that settles: where the site lives (a `site/` folder with its own `package.json`, outside the npm workspaces, so Astro never enters Arthur's own dependencies, which the styleguide keeps to the toolchain); hosting (GitHub Pages through a workflow, or another); the address (`kacperadler.github.io/arthur` or the owner's own domain); which pages come first (landing, roadmap generated from the roadmap and the board, the diagram); how the docs pages are fed from `packages/*/docs/commands/` later; how CI builds the site and catches a broken build.
- A logo of a conductor with a baton (the owner's choice): three simple SVG variants of it, each readable at 32 px as a favicon and in one colour, rendered to PNG for the owner to choose from; the chosen one is used on the site and in the README.
- A setup guide (`docs/setup.md`, also a site page): from a fresh VPS to a running Arthur, step by step, each step with the command that checks it; where a step is not built yet, it says so.
- The plan proposes how Arthur itself helps with setup: an `arthur setup` that walks the owner through each missing step, built on `arthur doctor` (roadmap entry 80: every requirement with its check and its one-command fix) and `arthur init` (entry 42); which roadmap entries this adds or moves.
- Built only after the plan is approved.

## Scope

In:
- The plan; then the site under its own folder and one workflow.

Out:
- Arthur's own packages and their dependencies.

## Decisions

- 2026-10-17: The owner proposed it; Astro Starlight.
- 2026-10-17: The owner: Arthur needs a logo, e.g. a butler or a conductor.
- 2026-10-17: The owner: the logo is a conductor with a baton. A setup guide is needed, and Arthur should help with setup itself.
