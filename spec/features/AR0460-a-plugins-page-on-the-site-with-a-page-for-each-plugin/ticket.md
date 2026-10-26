# AR0460 - A plugins page on the site, with a page for each plugin

```json
{
  "id": "AR0460",
  "title": "A plugins page on the site, with a page for each plugin",
  "date": "2026-10-26"
}
```

## Description

The owner (2026-10-26, Telegram) asked for a page on the site that lists Arthur's plugins, with a page of its own for each plugin. Today the site has four pages (landing, roadmap, diagram, setup); a reader who wants to know what a plugin does has to go to GitHub and find its folder.

## Goal

Each plugin documents itself in its package already: `packages/<plugin>/docs/<plugin>.md` (develop, findings, github, manage, models, nvm, resources, session, telegram, uptime, commit-rules) and `packages/<plugin>/docs/commands/*.md` (each command's page, what `arthur <cmd> --help` prints). Seven have command pages only and no overview: core, delivery, machines, orchestration, projects, schedule, youtrack. The README's Features list holds one line per package (README.md:35-53). `site/README.md` already plans command pages from `packages/*/docs/commands/*.md` ("Command pages come later").

- Kind: docs

## Done means

- The site has a Plugins page: one entry per package in `packages/` (core first), its one-line summary, built or planned, and a link to its own page; the planned plugins (from `spec/vision.md`'s plugin table: discord, voice, docker, signal, slack, whatsapp, server) are listed as planned, without a page.
- Each package has its own page, generated at build: its overview (`docs/<plugin>.md`, or for the seven without one a short overview written in its package's `docs/<plugin>.md` from the vision and its option table), then each of its commands' pages; relative links point to GitHub, as on the other pages.
- The sidebar shows Plugins with each plugin under it; the landing page's Features list links each plugin's page.
- No page is written by hand under `site/src/content/`: everything is generated from the repository's files, as `site/README.md` says; a package without a docs folder or two command files of the same name in one package fail the build.
- `site/` tests cover the generation (a fake `packages/` tree); `npm test` and `npm run build` inside `site/` pass; a screenshot of the Plugins page and of one plugin's page in the final message.

## Scope

In:
- `site/scripts/generate.ts` and a new `site/scripts/plugins.ts`: the Plugins page and each plugin's page.
- `site/test/plugins.test.ts`: the generation.
- `packages/{core,delivery,machines,orchestration,projects,schedule,youtrack}/docs/<plugin>.md`: a short overview each (core: `docs/core.md` in its package).
- `site/README.md`: what the site builds.

Out:
- The diagrams' rendering: AR0459.
- Changing any command page's content beyond a link that breaks on the site.

## Decisions
- 2026-10-26: Merge a ticket once its review passed, without asking the owner (AR-D73); the owner: "If there is something that you can merge, just merge, do not ask me abut it" (AR-D91)

