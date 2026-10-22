# AR0291 - Outcome

- Merged: 2026-10-22, `fdf7054`
- Branch: h/2026-10-22-ar0291-c3f10825
- Reviews: review-1.md PASS
- Cost: worker $0.84, reviews $1.02; review rounds 1

## What went in

- `packages/*/evals/*/scenario.json` (19 scenarios): `match` and `never` patterns no longer carry `(?!.*--help)`; the eval stub answers every help call itself, so a pattern says only what the coordinator should do.
- `packages/develop/test/scenarios.test.ts`: the `fails` lines quote the plain patterns, and `delivery/worker-done` and `orchestration/night-one-line` start with `arthur merge --help`, proving a help call never counts against `never`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1018/1018 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
