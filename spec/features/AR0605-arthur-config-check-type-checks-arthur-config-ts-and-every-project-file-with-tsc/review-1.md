# AR0605 - Review 1

- Job: 2026-11-05-review-4498e5a1
- Branch: arthur/2026-11-05-worker-96dd160c
- Commit reviewed: 0f4fcbda49ac20c3124ae17b6340ed570088b185
- Verdict: FAIL

## Final message

I'm failing this for documentation. The code works: checks pass, mutations are caught, and the two-misspelt-keys case reports both. Two lines this branch adds to `packages/core/docs/commands/config.md` are wrong, though.

## Findings

1. **`packages/core/docs/commands/config.md:43`: the doc says a type error stops `arthur run` from starting, and it does not.** The branch adds "A type error in the config or a project file the type check reads … and a `tsc` that fails" to the list headed "Refused, one line each (the same lines refuse the start)". Only `cli.ts:111` calls `typeCheck` (through `configCheck`). The plan deliberately left `arthur run`'s start check unchanged, and AR-D500/AR-D506 approved that. So the page promises the service will not start with a type error, which the code does not do, and it is the very question the plan left open. The fix is to move this item out of that list, or say there that the start does not type-check.

2. **`packages/core/docs/commands/config.md:12`: "So a project file with three misspelt keys shows all three in one run" is not always true.** The worker's own final message says `tsc` reports only the first unknown key in one object literal. That is why the test puts each misspelt key in a separate helper call (`config-check.test.ts`, `pieces`). If the three keys sit in one helper call, only one line appears, and the page tells the owner one run catches them all. The sentence needs to say it holds for keys in separate objects, or calls.

## Notes
- (risk) `packages/core/src/type-check.ts:22`: `tsc` is run without a timeout. A `tsc` that hangs would stall `arthur config check`. The command is interactive, so this is low impact.
- (minor) `packages/core/src/type-check.ts:17`: the core reads the `projects` plugin's `folders` option by name. This is the plan's Option 1, which was approved, and its comment gives the reason.
- (minor) `test/structure.test.ts:14`: the core line budget goes from 7210 to 7238. Approved with the plan (AR-D506); it belongs in the merge's `outcome.md`.

## Checks (on 0f4fcbda)
- **`npm run check && npm test`:** `tsc` clean. That run's summary did not print because my grep pattern missed it, so I ran `npm test` again: tests 1566, pass 1502, fail 0, skipped 64, exit 0.
- **`npm run mutate`:** 25 mutants, 25 caught, 0 survived; 34 not run (`--max 25`).
- **Hand mutation:** I removed `types.ok &&` from `ok` in `packages/core/src/config-check.ts`. `node --import @arthur/core/testing --test packages/core/test/config-check.test.ts` then gave pass 8, fail 3, so the tests catch it. I restored the file with `git checkout`.
- **Leak check:** the diff contains no name of a real project or client.

FAIL