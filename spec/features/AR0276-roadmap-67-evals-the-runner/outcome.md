# AR0276 - Outcome

- Merged: 2026-10-22, `63e7408`
- Branch: h/2026-10-22-ar0276-evals-runner-eda48620
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $9.97, reviews $1.74; review rounds 2

## What went in

- `packages/core/src/cli.ts`: every `arthur` command refuses inside an eval session (`ARTHUR_EVAL` set), before loading anything; tested in `core/test/cli.test.ts`.
- `packages/develop/src/eval-command.ts`, `eval-run.ts`, `eval-scenario.ts`, `eval-stub.ts`: `arthur eval` finds `<package>/evals/<name>/` scenarios, copies each fixture into a fresh repository, replays one coordinator turn with `arthur` as a recording stub that refuses writes outside the run, kills the process group at the timeout, scores by what the run left, and compares pass rates with the baseline.
- `packages/develop/src/develop.ts`, `develop-options.ts`: the command and its `evals` options registered and checked.
- `packages/develop/test/eval.test.ts`: the edge cases (missing fixture, timeout, the stub never reaching the live home, baseline).
- Docs, `arthur.config.example.ts`, README, `arthur.mmd`: `arthur eval` documented and entry 67 shown as built; `test/structure.test.ts`: develop budget 584, core 5748.

## Checks on main

- `npm run check`: passed.
- `npm test`: 968/968 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0277 (F1), AR0278 (F2), AR0279 (F3).
