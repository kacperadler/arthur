# AR0028 - Outcome

- Merged: 2026-10-16, `859864c`
- Branch: h/2026-10-16-ar0028-ar0028-an-instanc-8c4cb0f9
- Reviews: review-1.md PASS
- Cost: worker $0.69, reviews $0.43; review rounds 1

## What went in

- `packages/core/src/env.ts`: `checkEnv` collects every prefix owner (plugins and named instances of enabled plugins) first; two owners of one prefix are refused naming both; a name belongs to the longest prefix across all plugins.
- `packages/core/test/env.test.ts`: the same-prefix and cross-plugin cases.

## Checks on main

- `npm run check`: passed.
- `npm test`: 47/47 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0030 (F1).
