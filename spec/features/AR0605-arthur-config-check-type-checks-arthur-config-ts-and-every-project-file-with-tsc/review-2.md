# AR0605 - Review 2

- Job: 2026-11-05-review-10fe02cf
- Branch: arthur/2026-11-05-worker-96dd160c
- Commit reviewed: ac5b59b930caa76e78f5e5722ef33043d72f0cf4
- Verdict: PASS

## Final message

## Findings

None. Both findings from review 1 are fixed, and the two corrected lines in `packages/core/docs/commands/config.md` match the code.

1. **`config.md:18`**: it now says a type error fails the check but does not refuse the start, because `arthur run` does not type-check. A grep of `configCheck(` and `typeCheck(` across `packages/` agrees: `typeCheck` is called only from `configCheck` (`config-check.ts:42`), and `configCheck` only from `cli.ts:111` (the `config check` command). Nothing on `arthur run`'s start path reaches it. The type error is gone from the list headed "Refused, one line each (the same lines refuse the start)". The exit-code line still counts a type error toward exit 1, which matches `ok` requiring `types.ok`. This also follows the plan's choice, approved under AR-D506, to leave `arthur run` unchanged.
2. **`config.md:12`**: it now says misspelt keys in different objects all show in one run, and that within one object `tsc` names only the first unknown key. That matches how `tsc` reports unknown keys: once per object literal. The first new test in `config-check.test.ts` pins the "all in one run" case: three wrong keys in three separate objects (one in the config's helper call, two in the project file's separate helper calls) come out as three lines, then exit 1. That sentence also matches `type-check.ts:17-20`: the first `projects` entry, skipped when it has `enabled: false`, folders resolved from the working folder, and folders without `project.config.ts` left out.

## Notes
- (risk) `packages/core/src/type-check.ts:22`: `tsc` runs without a timeout. A `tsc` that hangs would stall `arthur config check`. Low impact, since the command is run by hand. Carried over from review 1.
- (minor) `packages/core/src/type-check.ts:17`: the core reads the `projects` plugin's `folders` option by name. This is the approved Option 1 from the plan.
- (minor) `test/structure.test.ts:14`: the core line budget goes from 7210 to 7238. It was approved with the plan (AR-D506) and belongs in the merge's `outcome.md`.

## Checks (on ac5b59b9)
- **`npm run check && npm test`**, one bash call, timeout 1800: `tsc` passed. The `npm test` summary didn't print because my grep pattern missed it, so the call ended with exit 1 from grep, not from the tests. I ran `npm test` again on its own: tests 1566, pass 1502, fail 0, skipped 64, exit 0.
- **Mutations**: not run this time. The branch's code is unchanged since review 1, which found 25 mutants caught and 0 survived. This commit changes only `config.md`.

PASS