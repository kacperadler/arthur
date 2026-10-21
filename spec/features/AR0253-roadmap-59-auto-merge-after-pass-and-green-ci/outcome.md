# AR0253 - Outcome

- Merged: 2026-10-21, `98cfb0f`
- Branch: h/2026-10-21-ar0253-roadmap-59-auto-m-df78fc6b
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $9.69, reviews $2.10; review rounds 2

## What went in

- `arthur merge <job> --auto [--no-ci]`: merges only with a PASS on the tip, CI passed (github's new `github.ci`), the project's `autoMerge` on, and no held path (roles, vision, workflows, any `package.json`, the always-review list, renames under both names); each refusal names its rule.
- A branch waiting on CI wakes the coordinator once per run end, across a restart; a run hung for 30 minutes is cancelled (`github.cancel`).
- `github-ci.ts`, `auto-merge.ts`, `merge-command.ts` on the always-review list. Budgets delivery 1232, github 621.

## Checks on main

- `npm run check`: passed.
- `npm test`: 889/889 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0257 (F1), AR0258 (F2), AR0259 (F3).
