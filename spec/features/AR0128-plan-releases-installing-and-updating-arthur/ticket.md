# AR0128 - Plan: releases, installing, and updating Arthur

```json
{
  "id": "AR0128",
  "title": "Plan: releases, installing, and updating Arthur",
  "date": "2026-10-18"
}
```

## Description

Arthur has no release yet: `docs/setup.md` installs it with `git clone` and `npm ci`, `arthur version` prints a hash of the core's files, and every package is `private`. The roadmap's machine fix says `npm i -g arthur`, which does not work today. This ticket writes the plan for releases, installing and updating, for the owner to approve before any code.

## Goal

People install and update Arthur in one known way, and Arthur can tell when two machines or a plugin run different versions.

- Kind: improvement
- Plan: tak

## Done means

- `plan.md` in this folder, with options and a recommendation for each:
  - Versions: semver per release (`0.x` until the plugin API freezes, entry 51), or one version for the core and all first-party plugins.
  - Channel: npm packages (`arthur`, `@arthur/*`), GitHub releases with a tag, or both; who publishes and how (a GitHub Actions workflow on a tag, its token kept as a secret).
  - Install: `npm i -g arthur` plus plugins, or `git clone`; what `docs/setup.md` step 4 becomes.
  - `arthur version`: the release version plus the commit hash; what the machines plugin (entry 30) compares; a plugin built for another core version refused or warned at load.
  - Updating: `arthur update` or `npm i -g arthur@latest` with a restart once no job runs; a notice when a new release exists; machines updated over SSH.
  - The CHANGELOG per release, from the merged tickets (entry 56).
  - Where it lands in the roadmap: new entries, their numbers and dependencies.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- The roadmap and vision edits: a follow-up ticket after the owner picks.

## Decisions

- 2026-10-18: The owner asked how releases, installing and version checks will work; the coordinator proposes a plan first.
