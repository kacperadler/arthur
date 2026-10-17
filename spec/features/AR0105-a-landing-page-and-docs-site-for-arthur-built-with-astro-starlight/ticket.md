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

- A plan, approved by the owner, that settles: where the site lives (a `site/` folder with its own `package.json`, outside the npm workspaces, so Astro never enters Arthur's own dependencies, which the styleguide keeps to the toolchain); hosting on GitHub Pages through a workflow at `kacperadler.github.io/arthur` (the owner's choice); which pages come first (landing with the logo of AR0106, roadmap generated from the roadmap and the board, the diagram, the setup guide of AR0107); how the docs pages are fed from `packages/*/docs/commands/` later; how CI builds the site and catches a broken build.
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
- 2026-10-17: The owner: `arthur setup` finds the tools on the machine, shows what is configured and what is not, and what can still be put in the config.
- 2026-10-17: The owner: GitHub Pages at kacperadler.github.io/arthur; plan now, during the pause. The logo is AR0106, the setup guide and `arthur setup` are AR0107.
