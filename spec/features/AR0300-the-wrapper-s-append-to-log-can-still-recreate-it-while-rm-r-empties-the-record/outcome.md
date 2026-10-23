# AR0300 - Outcome

- Merged: 2026-10-23, `e0a3aea`
- Branch: h/2026-10-22-ar0300-f1036105
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.19, reviews $1.02; review rounds 2

## What went in

- `packages/core/src/wrapper.ts`: `log` is created once at the wrapper's start; every later append opens it without `O_CREAT`, and a missing `log` counts as the record being removed, so the wrapper ends with its one line and `rm -r` of a record succeeds. Budget core 5755.
- `packages/core/docs/commands/spawn.md`: removal is noticed when `log` is gone; known limit: the other record files are renamed into place, so a removal racing one can still fail with `ENOTEMPTY`.
- `packages/core/test/wrapper.test.ts`: plays `rm -r` step by step against a running wrapper.
- `test/structure.test.ts`: budgets set to their counts (projects 485, commit-rules 165).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1039/1039 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0306 (F1).
