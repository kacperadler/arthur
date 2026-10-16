# AR0005 - Outcome

- Merged: 2026-10-16, `dd698ee`
- Branch: h/2026-10-16-ar0005-config-defineconf-feee6814
- Reviews: review-1.md PASS
- Cost: worker $1.48, reviews $0.39; review rounds 1

## What went in

- `packages/core/src/config.ts`: `defineConfig`, the config types, and `loadConfig(path)`, which imports `arthur.config.ts`, checks the nine core options (every problem listed, each with its option path and expectation), and fills defaults (`home` `.arthur`, `agent.command` `omp`, jobs 120 min, $2, cores-1 CPU, 70% memory).
- `packages/core/test/config.test.ts`: one test per refusal and edge case.
- `packages/core/package.json`: `exports` for `@arthur/core`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 26/26 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
