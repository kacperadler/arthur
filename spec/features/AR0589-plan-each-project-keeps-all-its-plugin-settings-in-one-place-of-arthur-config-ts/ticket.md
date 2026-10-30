# AR0589 - Plan: each project keeps all its plugin settings in one place of arthur.config.ts

```json
{
  "id": "AR0589",
  "title": "Plan: each project keeps all its plugin settings in one place of arthur.config.ts",
  "date": "2026-10-30"
}
```

## Description

The owner, 2026-10-30: "i added a new project and then i have a dokploy for it but the dokploy is another plugin so i have to remember about adding the project, the dokploy ect, its not about one config lets say in porjekct, its in pultiple parts of config [...] right nowe we can ad more and more plugins but the structure should look good too".

Today a project's settings live in two shapes. Some are keys of its `projects` entry, which the projects plugin knows by name (`tracker` for youtrack, `chat` for a channel, `docker`, `requires`; `arthur.config.example.ts:249-307`). Others sit in another plugin's own section, keyed by the project's name (`uptime({ sites: { "acme-shop": [...] } })`, `arthur.config.example.ts:330-337`). Each new plugin with something per project (dokploy, AR0588) adds one more place to remember.

## Goal

Adding a project is one edit in one place: everything about that project, for every plugin, sits together, while accounts and tokens (a plugin's instances) stay in the plugin's own section. A plugin declares the project key it reads and checks it, so the projects plugin does not grow with every plugin.

- Kind: refactor
- Plan: yes

## Done means

- A plan, approved by the owner, that builds the shape the owner picked in AR-D391: a folder per project with its config file, docs and criteria, each plugin giving a `.project()` helper for its per-project part, plugins with accounts once in arthur.config.ts; how a plugin declares and checks its project key through the host (no plugin imports another); what moves (uptime's `sites`, the `tracker` and `chat` keys, and the dokploy key of AR0588) and that no old shape is kept; how `arthur doctor` reports a project key no enabled plugin reads; the line budgets; the tickets it splits into.

## Scope

In:
- The plan only: `spec/features/AR0589-*/plan.md`.

Out:
- The dokploy plugin itself: AR0588, which follows the shape this plan picks.

## Decisions
- 2026-10-30: A folder per project (projects/<name>/) with its config file, docs and criteria, paths relative to it; the file holds only that project pieces, each made by its plugin helper (uptime.project, dokploy.project, youtrack.project); arthur.config.ts keeps each plugin with accounts once and loads the project files; each plugin checks its own pieces at start; the owner: "…" (AR-D391, cut: arthur decisions AR-D391 prints it whole)
