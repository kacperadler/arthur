# AR0589 - Outcome

- Merged: 2026-10-30, `1f31ca20`
- Branch: arthur/2026-10-30-worker-c6b3974c
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $21.10, reviews $1.58; review rounds 2

## What went in

- packages/core/test/roles.test.ts: the absolute prompts test also refuses a symlinked folder inside the project folder.
- test/piece-order.test.ts: new root test; delivery and machines, each listed before projects, still refuse a bad piece through the real CLI, and accept a good one.
- .gitignore: not described
- README.md: not described
- arthur.config.example.ts: not described
- docs/plugin-api.md: not described
- docs/setup.md: not described
- packages/commit-rules/docs/commit-rules.md: not described
- packages/commit-rules/src/commit-rules-options.ts: not described
- packages/commit-rules/src/commit-rules.ts: not described
- packages/commit-rules/src/hook.ts: not described
- packages/commit-rules/test/commit-rules.test.ts: not described
- packages/core/docs/commands/doctor.md: not described
- packages/core/docs/commands/roles.md: not described
- packages/core/src/host.ts: not described
- packages/core/src/plugin-host.ts: not described
- packages/core/src/plugin.ts: not described
- packages/core/src/project-pieces.ts: not described
- packages/core/src/roles.ts: not described
- packages/core/src/testing.ts: not described
- packages/core/test/host.test.ts: not described
- packages/delivery/docs/commands/merge.md: not described
- packages/delivery/docs/delivery.md: not described
- packages/delivery/src/auto-merge.ts: not described
- packages/delivery/src/delivery.ts: not described
- packages/delivery/src/pass-forward.ts: not described
- packages/delivery/src/review-needed.ts: not described
- packages/delivery/test/auto-merge.test.ts: not described
- packages/delivery/test/merge.test.ts: not described
- packages/delivery/test/review.test.ts: not described
- packages/develop/docs/commands/plugin.md: not described
- packages/develop/docs/develop.md: not described
- packages/findings/docs/findings.md: not described
- packages/findings/src/findings-options.ts: not described
- packages/findings/src/findings.ts: not described
- packages/findings/test/findings-options.test.ts: not described
- packages/findings/test/on-merge.test.ts: not described
- packages/github/docs/commands/ci.md: not described
- packages/github/docs/commands/github.md: not described
- packages/github/docs/github.md: not described
- packages/github/src/github-api.ts: not described
- packages/github/src/github-ci.ts: not described
- packages/github/src/github-command.ts: not described
- packages/github/src/github-options.ts: not described
- packages/github/src/github.ts: not described
- packages/github/test/github-pr.test.ts: not described
- packages/github/test/github.test.ts: not described
- packages/machines/docs/commands/machines.md: not described
- packages/machines/docs/machines.md: not described
- packages/machines/src/machine-place.ts: not described
- packages/machines/src/machines.ts: not described
- packages/machines/test/machines.test.ts: not described
- packages/manage/docs/manage.md: not described
- packages/nvm/docs/nvm.md: not described
- packages/projects/docs/commands/init.md: not described
- packages/projects/docs/commands/projects.md: not described
- packages/projects/docs/projects.md: not described
- packages/projects/src/init.ts: not described
- packages/projects/src/install.ts: not described
- packages/projects/src/onboarding.ts: not described
- packages/projects/src/project-file.ts: not described
- packages/projects/src/project-options.ts: not described
- packages/projects/src/projects.ts: not described
- packages/projects/test/folders.ts: not described
- packages/projects/test/init.test.ts: not described
- packages/projects/test/install.test.ts: not described
- packages/projects/test/onboarding.test.ts: not described
- packages/projects/test/project-options.test.ts: not described
- packages/projects/test/projects.test.ts: not described
- packages/uptime/docs/uptime.md: not described
- packages/uptime/src/uptime-options.ts: not described
- packages/uptime/src/uptime.ts: not described
- packages/uptime/test/uptime-options.test.ts: not described
- packages/uptime/test/uptime.test.ts: not described
- packages/youtrack/docs/commands/youtrack.md: not described
- packages/youtrack/docs/youtrack.md: not described
- packages/youtrack/src/youtrack-command.ts: not described
- packages/youtrack/src/youtrack-options.ts: not described
- packages/youtrack/src/youtrack.ts: not described
- packages/youtrack/test/youtrack.test.ts: not described
- spec/roadmap.md: not described
- spec/vision.md: not described
- test/arthur-criteria.test.ts: not described
- test/ci-wait-wake.test.ts: not described
- test/findings-merge.test.ts: not described
- test/job-gate.test.ts: not described
- test/onboarding-merge.test.ts: not described
- test/option-tables.test.ts: not described
- test/project-folders.ts: not described
- test/structure.test.ts: not described

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1329/1397 passed.

## Left open

- Findings: none; no findings.md on this ticket.

## Config swap at the merge

The real `arthur.config.ts` is git-ignored, so the coordinator swapped it by hand at this merge:

1. Before the merge: wrote `arthur.config.next.ts` (the old config with `projects({ folders: ["projects/arthur"] })` in place of the `list`, and `findings()` with no `mode`) and `projects/arthur/project.config.ts` with the pieces `projects.project`, `delivery.project({ autoMerge: true })` (AR-D345), `github.project({ workflow: "ci.yml" })`, `commitRules.project({ regex })` and `findings.project("summary")`.
2. After the merge: `mv arthur.config.next.ts arthur.config.ts`, then `arthur config check` (every variable set), `arthur doctor` (every line ok) and `arthur projects` (AR Arthur listed).
3. The old config is kept outside the repository until the next restart proves the new one.
