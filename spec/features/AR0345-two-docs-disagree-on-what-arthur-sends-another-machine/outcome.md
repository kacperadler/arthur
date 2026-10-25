# AR0345 - Outcome

- Merged: 2026-10-25, `d732ba4f`
- Branch: arthur/2026-10-25-worker-e48e0ded
- Reviews: review-1.md PASS
- Cost: worker $0.71, reviews n/a; review rounds 1

## What went in

- `packages/core/src/jobs.ts:176`: the spawn warning for a job on another machine reads `MCP servers left out on <machine>, which Arthur sends no MCP secret (arthur spawn --help, "On another machine"): <names>`; edited in place, the core's line count unchanged. `packages/core/test/machine.test.ts` asserts the new line.
- `packages/orchestration/docs/commands/coordinator.md:139`, `packages/core/docs/commands/spawn.md:21`: say Arthur sends another machine no MCP secret and point to "On another machine"; `spawn.md:22` adds that a `prepare`'s variables are in the environment of every tool call of the job too.
- `docs/deploy.md:9`: the same claim, now "no MCP secret", naming the variables a `prepare` returns (a provider's key of the models plugin).
- Review PASS (review-1.md). Merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1106/1106 passed.

## Left open

- Tickets from findings: AR0413 (F1).
