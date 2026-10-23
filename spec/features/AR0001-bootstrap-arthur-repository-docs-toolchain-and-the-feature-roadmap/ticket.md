# AR0001 - Bootstrap: Arthur repository, docs, toolchain and the feature roadmap

```json
{
  "id": "AR0001",
  "title": "Bootstrap: Arthur repository, docs, toolchain and the feature roadmap",
  "date": "2026-10-16"
}
```

## Description

Turn the drafts in `spec/draft/` into Arthur's first real files, set up the toolchain so every later ticket is built and tested the same way, and write the roadmap: the ordered list of feature tickets that builds Arthur from core to plugins.

## Goal

Arthur is a public, English-only rebuild of the harness the owner runs today: one core (job runner, board, config loader, plugin host, event stream, guards) and plugins behind interfaces (orchestration, session, schedule, projects, delivery, commit-rules, github, youtrack, telegram, then manage, develop, signal, whatsapp, server). `spec/draft/` holds the design: `vision.md`, three `.mmd` diagrams, `arthur.config.ts` (example), `inventory.md` (every capability of today's harness and its Arthur home), and today's styleguide and review criteria for reference. The drafts mention today's harness, its tickets (K0252…) and its file paths; the public repository must stand on its own.

- Kind: feat

## Done means

- `spec/vision.md` is Arthur's vision, from `spec/draft/vision.md`, standing on its own: no reference to today's harness tickets, its file paths or "this repository" meaning the old one; the one open question (coordinator as a required plugin) is decided as a required `orchestration` plugin.
- `docs/architecture/*.mmd` holds the three diagrams, parsing as Mermaid; `arthur.config.example.ts` the example config; `LICENSE` is FSL-1.1-ALv2 with `Copyright 2026 Kacper Adler`; `README.md` says in a few lines what Arthur is, its status (in development, not usable yet), and points at the vision and diagrams.
- `.agents/harness/criteria/styleguide.md` and `review.md` are filled for Arthur (adapted from the reference copies, English): small TypeScript, no runtime dependencies, Node 24 with `node --test`, one file one job, core and every plugin tested apart against fakes, a plugin never imports another plugin or core internals, only the published interface; edge cases tested, never only the happy path. The other criteria skeletons are filled minimally or left with their headings.
- Toolchain: `package.json` (`npm run check` = `tsc`, `npm test` = `node --test`), `tsconfig.json`, a layout `packages/core/`, `packages/<plugin>/` (or the simplest layout that keeps each plugin an importable unit with its own tests), one trivial test proving the runner works, and a GitHub Actions workflow on ubuntu running `npm ci && npm run check && npm test` on push and pull request.
- `spec/roadmap.md`: the ordered list of feature tickets, each with a title, what it delivers through which interface, its Done means in a few lines including the edge cases to test, what it depends on, and a size of roughly half a day to a day of agent work (not a one-liner, not a whole plugin with everything). First the core, piece by piece (config loader and validation, plugin host and its interface, job runner, board, event stream, guards), then the first-version plugins in the vision's order, each first against a fake host. The three plugins that define the plugin API (telegram, youtrack, schedule) come before the API is frozen. Base the list on `spec/draft/inventory.md` so no capability is lost; every inventory row lands in a ticket or is marked out of scope.
- `spec/draft/` is deleted once its content has a home.
- `npm run check` and `npm test` pass.

## Scope

In:
- The files above.

Out:
- Any feature code beyond the one trivial test; creating the roadmap's tickets (the coordinator does that from `spec/roadmap.md`).

## Decisions

- 2026-10-16: The owner: Arthur is English only, FSL-1.1-ALv2, OMP as the agent, config in TypeScript naming env variables (`ARTHUR_` prefix), exposes nothing to the internet, starts with an empty board, the coordinator always on. Tickets go feature by feature, neither too small nor too large, each module and plugin tested on its own with edge cases, each plugin only an interface to Arthur.
- 2026-10-16: The owner: AR tickets need no approval; the coordinator orders, starts and merges them after a review PASS and green checks.
