# AR0074 - Review 1

- Job: 2026-10-16-review-ar0074-ar0074-cor-38efb310
- Branch: h/2026-10-16-ar0074-ar0074-core-one-f-ea466a36
- Commit reviewed: a5c683650095f7d08d5a5653109a3a86b88707df
- Verdict: PASS

## Final message

Worktree clean, no leftover edits.

---

**Findings:** None that block merge.

**Notes (non-blocking):**
- `flags.ts:9` uses `Object.hasOwn(checks, name)` to reject prototype-chain property names (`--constructor`, `--toString`, `--__proto__`, `--hasOwnProperty`) as `unknown flag`, correctly verified by hand (`node` probe against the delivered, unmutated file): all four print `unknown flag --<name>`. No permanent test pins this; mutating the lookup to the `in` operator (`name in checks`) still passes all 272 tests. The ticket's scope is "no behaviour change" for a pure refactor, and the worker's final message is transparent that this was checked only via a deleted throwaway equivalence script (3.3M argument lists, 0 diffs vs. the old per-command loops), which the Verify workflow allows for a cleanup/no-new-behavior ticket. Not a ticket violation, but a one-line regression test for this specific lookup would close the gap if the file sees more traffic.

**Checks run (in this worktree, range `fbd85df5..a5c6836`):**
- `npm ci` — clean.
- `npm run check` (tsc) — no errors.
- `npm test` — 272/272 pass, 0 fail (matches worker's claim).
- Core line count: `find packages/core/src -name '*.ts' | xargs wc -l` → 4329 at tip; same measured at base commit (`fbd85df5`, via `git archive` into a scratch dir) → 4339. Net −10, matches "about 10" and the worker's stated 4339→4329.
- `grep` for `AMOUNT`/old `FLAGS` arrays in `packages/core/src` → none; confirms the duplicated `AMOUNT` regex and the three ad-hoc loops are gone, replaced by the single `flags.ts` (21 lines, no imports, under the 200-line cap, no runtime dependency).
- Diff scope: only `cli.ts`, `flags.ts`, `job-commands.ts`, `spawn-command.ts` touched (4 files, +34/−44) — matches proposal A7's named files and the "touch only your proposal's files" instruction; no other core file (`board.ts`, `host.ts`, `jobs.ts`, etc.) touched, consistent with the parallel worker's AR0073 ticket owning those.
- Line-by-line diff trace of every refusal path (`needs a value`, `given twice`, `needs a number of 0 or more, got …`/`got nothing`, `unknown flag …`, `--project` single-dash rejection, order of checks: value→given-twice→amount) against the pre-change loops in `cli.ts`, `spawn-command.ts`, `job-commands.ts`: byte-identical in every case, including the deliberate `continue`-vs-`spawn` wording difference for a missing `--budget` value (`needs a value` vs `got nothing`), which the existing pinned tests (`cli.test.ts:89-92`, `spawn.test.ts:140-150`, `job-control.test.ts:444-451`, `job-records.test.ts:236-237`) already assert and which passed unchanged.
- Mutation testing on `flags.ts` (throwaway edits, restored via `git checkout --` after each, worktree confirmed clean): inverted the given-twice ternary → caught (assertion failure); disabled given-twice entirely → caught; widened the `amount` regex to accept a leading `-` → caught; flipped `keep`'s default to `true` → caught. Only the `Object.hasOwn`→`in` swap (noted above) survived.
- Doc pages and `USAGE` strings: untouched by the diff (confirmed via `git diff --stat`); worker's claim of "no usage line, doc or test changed" holds.

PASS
