# AR0318 - Review 1

- Job: 2026-10-23-review-ar0318-c4731013
- Branch: h/2026-10-23-ar0318-73f850b5
- Commit reviewed: 31762932becc3b59e37ff4277217250afc4776c1
- Verdict: PASS

## Final message

## Findings

None. The change is scoped exactly to the ticket: `machine-check.ts`'s `IDENTITY` loop now tags the failing iteration's variable as `git` when `git var` exits 127, and `checkMachine` matches `/^identity git ?(.*)$/m` before building the online report, returning offline with `git is not there (<line or "exit code 127">)` and the exact fix text the ticket specifies. This is the ticket's second option ("make no git an offline reason as no `arthur` is"), explicitly justified in the final message against the first option (which the existing "placed by its labels all the same" identity test shows would still let a no-git machine take jobs — against the ticket's Goal).

## Verification performed

- `npm ci`: clean, 22 packages.
- `npm run check`: `tsc`, no output, clean.
- `npm test` (full suite, in this worktree): `1051 pass, 0 fail` — matches the worker's claimed count exactly.
- `node --test packages/machines/test/machines.test.ts test/structure.test.ts`: `34 pass, 0 fail` — matches worker's claim.
- Mutation 1 (removed `[ $? -eq 127 ] && var=git;` from `IDENTITY`): broke both the offline-reasons table test and the new placement test ("a machine without git takes no job"), restored via `git checkout --`. Matches worker's table.
- Mutation 2 (regex required trailing space, `identity git (.*)` instead of `identity git ?(.*)`): broke the offline-reasons table at the `mute` row — the exact bypass the worker's final message calls out (empty `$said`/missing `tail` yields `identity git` with no trailing space). Restored via `git checkout --`.
- Read `checkMachine`'s full body: the new `none` check runs before the existing identity-extraction line, so a 127 never reaches the online path; the untouched exit-128 (fatal "no identity") path still falls through to `identity` extraction, confirmed passing in the full suite ("a machine online whose git has no identity is said in its doctor line…").
- Confirmed file sizes: `machine-check.ts` 103 lines (well under the 200-line file cap); `structure.test.ts`'s `machines` budget raised 484→487, matching the ticket's Decision and the worker's stated `git diff --numstat`.
- Docs: `docs/deploy.md` step 3 and `packages/machines/docs/commands/machines.md` both updated with the new offline reason/fix, consistent with the existing `arthur is not there` entries' style.
- No boundary, shape, or scope violations: no new runtime dependency, no class/enum, no plugin-to-plugin import, no file outside `packages/machines/{src,test,docs}`, root `docs/deploy.md`, and `test/structure.test.ts`'s budget table — all directly required by the fix.

## Notes

None beyond scope.

PASS
