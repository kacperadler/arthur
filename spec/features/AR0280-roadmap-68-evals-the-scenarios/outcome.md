# AR0280 - Outcome

- Merged: 2026-10-22, `1978fb0`
- Branch: h/2026-10-22-ar0280-eval-scenarios-4e8abbcc
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS, review-4.md PASS
- Cost: worker $18.05, reviews $3.04; review rounds 4

## What went in

- `<package>/evals/<name>/` in delivery, github, manage, orchestration, projects and session: the 19 scenarios of entry 68, each a `scenario.json` (turn, stub answers, expected reply and tool calls) and a `fixture/`; stub answers never answer a `--help` call.
- `evals/baseline.json`: each scenario's pass rate from 3 real-model runs (9 at 3/3, 10 below 2/3, the causes named in the ticket's result).
- `packages/develop/src/`: the runner pushes the run's `main` with `--set-upstream`, and `never` patterns skip `--help` calls; develop budget 622.
- `packages/develop/test/`: every scenario scored against the fake agent in `npm test`; docs and README show 68 built.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1013/1013 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0286 (F1), AR0287 (F2), AR0288 (F3).
