# AR0087 - Outcome

- Merged: 2026-10-17, `04ec21e`
- Branch: h/2026-10-17-ar0087-project-list-83287a88
- Reviews: review-1.md PASS
- Cost: worker $6.04, reviews $1.19; review rounds 1

## What went in

- `packages/projects/`: the new projects plugin: checks the list in the config (name, prefix, path or repo, title, about, unique keys), clones a missing `repo`, runs a project's install, and gives the coordinator one line per project to match the owner's words.
- `packages/core/src/job-checkout.ts`, `jobs.ts`: a job starts from its project's folder in the list (`--project`).
- `.gitignore`: `arthur.config.ts` stays out of Git, so the owner's real project list is never pushed.
- `arthur.config.example.ts`, docs: made-up projects only; no `pathPrepend`.
- `spec/roadmap.md`: entries 41, 42 (onboarding adds `.nvmrc`) and 84 (the nvm plugin).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 329/329 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: F1-F2 dropped (see findings.md).
