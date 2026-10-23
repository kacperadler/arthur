# AR0087 - Roadmap 41: the project list, planned from the harness projects

```json
{
  "id": "AR0087",
  "title": "Roadmap 41: the project list, planned from the harness projects",
  "date": "2026-10-16"
}
```

## Description

Roadmap entry 41 (`spec/roadmap.md`). The human wants the coordinator to find the project he means simply, from a prefix or a name, and the config to stay simple. The harness Arthur replaces is the worked example: plan the entry from what it has today.

What the harness has (2026-10-16):
- Projects: this checkout plus `.h/repos`, one path per line, registered by the first `h spawn --repo`.
- Each repository's `.agents/harness/project.json`: `prefix` (required), `ci` (workflow name), `automerge`.
- The 8 projects: K harness; AR Arthur; MP Shop in two checkouts with one prefix (`shop/main` and `shop/south`, client branches `north`, `south`); KA portfolio.example (portfolio, Astro, Bun); CS helpdesk (internal app, Bun); QA QA Board (YouTrack overlay, CI `Linux`); EL Reviewer (review tool on issue trackers); EDLS Acme EV charging site.
- `spec/clients.json` (client keys for YouTrack agreements), `ISSUES.md` per client repository, `H_PATH_PREPEND` (bun) per repository.
- What went wrong: a prefix with no name means the coordinator guessed; `/projects` showed only prefix and folder; a job spawned from inside a repository was registered nowhere (K0240).

## Goal

The owner names a project as he likes and the coordinator finds it without asking; adding a project is a few lines (vision A).

- Kind: feat
- Plan: tak

## Done means

- A plan the owner approves, which settles and justifies: where the list lives (the config file, a file per repository like `project.json`, or both, and which wins); the fields and which are required (`name`, `prefix`, `title`, `about`, `path` or `repo`, aliases?); one project in two checkouts or with client branches (the MP case); how the coordinator matches a word in the owner's message to a project (prefix, name, title, alias; an ambiguous word asks); what its context shows every turn and how long it may be; how a project is added (`arthur project add`, onboarding 42) and what `arthur doctor` checks; migration of the 8 harness projects as a worked example in the plan.
- Then entry 41's Delivers and Done means as the plan settles them, each case tested.
- `npm test` and `npm run check` pass.

## Scope

In:
- The `projects` plugin (entry 41); the line it gives the coordinator's context (25).

Out:
- Onboarding (42), trackers (44), the harness itself (K0259 dropped: the harness stays as it is).

## Decisions

- 2026-10-16: The human: take the harness's projects as the example for Arthur and plan it well; not built in the harness (K0259 dropped).
- 2026-10-16: The human: start the plan now.
- 2026-10-17: The owner: shop is three projects, MP shop/main, LB shop/north, LA shop/south.
- 2026-10-17: The owner, on dropping pathPrepend: two projects may need different versions of one tool (e.g. Node through nvm); not settled yet, asked how.
- 2026-10-17: The owner: no pathPrepend; tool versions come from an nvm plugin, and onboarding a project adds an .nvmrc file to it. Revise the plan and roadmap (entry 42 onboarding, a new nvm plugin entry) to match.
- 2026-10-17: Plan approved by the human: plan.md at 171a639 (open questions as the plan answers them: a missing Node version refuses the spawn naming nvm install; .nvmrc as the plan says).
- 2026-10-17: The owner: the real project list stays local, never on GitHub (the repo is public): arthur.config.ts in .gitignore, examples and tests use made-up projects.
- 2026-10-17: The owner says merge.
