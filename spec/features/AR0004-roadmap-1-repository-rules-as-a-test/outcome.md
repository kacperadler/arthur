# AR0004 - Outcome

- Merged: 2026-10-16, `705dc1f`
- Branch: h/2026-10-16-ar0004-repository-rules-e926d472
- Reviews: review-1.md PASS
- Cost: worker $1.19, reviews $0.37; review rounds 1

## What went in

- `test/structure.ts`: `checkStructure(root, budgets)` checks no runtime dependencies, no `index`/`types`/`utils` files, no `class`/`enum`, `src/` files at most 200 lines, a line budget per package (core 4000), plugin and core import boundaries, a test per package.
- `test/structure.test.ts`: the rules on the repository, plus one fixture per rule and the edge cases.
- `package.json`, `tsconfig.json`: `npm test` and `tsc` include `test/`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 12/12 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0026 (F1), AR0027 (F2).
