# AR0144 - Review 1

- Job: 2026-10-18-review-ar0144-5e5d9cbb
- Branch: h/2026-10-18-ar0144-a025af87
- Commit reviewed: f2b02404532bbcf57321a708cc60d7cc8af98c9e
- Verdict: PASS

## Final message

Clean tree, no leftover mutations.

## Findings

None blocking.

## Notes

- `arthur.config.example.ts` still sets `restartGuard: true` / `probeLlm: true`, which `session`'s `checkOptions` would refuse as unknown until entries 37/38 land — pre-existing from entry 35's branch (unchanged by this diff; `git show 905ba9e...:arthur.config.example.ts` has the same lines), not a regression here.
- Finding F1 (uncaught exception in the 500 ms tick ends `arthur run`) is correctly logged as `open`, matches entry 35's pre-existing exposure; not this ticket's scope to fix.

## Checks run (in this worktree, against `905ba9e5b1..f2b02404`)

- `npm ci`: installs cleanly (10 packages).
- `npm run check`: `tsc` passes, no errors.
- `npm test`: 469/469 pass, including 17 new tests in `restart.test.ts` and 1 new in `coordinator.test.ts`.
- Line budgets: `cat packages/session/src/*.ts | wc -l` → 453 (matches ticket Decision 213→453); `cat packages/orchestration/src/*.ts | wc -l` → 903 (matches 892→903); `test/structure.test.ts` budgets updated to the same numbers with the reason recorded in-file.
- Per-file size: every touched/new file ≤ 200 lines (`restart.ts` 155, `request.ts` 58, `handoff-extension.ts` 148, `session.ts` 92, `coordinator.ts` 127, `orchestration.ts` 111).
- No `class`/`enum`/`namespace` in changed files; no `package.json` touched (no new deps); boundary imports only `@arthur/core/clock`, `@arthur/core/plugin`, `@arthur/core/testing` and `./request.ts`/`./session.ts` within the same package — no cross-plugin import, no path import of core internals.
- Mutation 1: disabled the `/restart` job-running refusal (`if (ids.length > 0) return {error...}` → `if (false)`) → `/restart with one job running is refused...` test failed as expected; reverted (`git checkout --`).
- Mutation 2: disabled the night/`/restart` job-recheck in `settle()` (`if (ids.length > 0) {` → `if (false) {`) → `a job started during the wait for the handoff: no restart, the wait goes on...` test failed; reverted.
- Mutation 3: removed the `rmSync` that clears the orchestration `fresh` mark after a fresh start → `coordinator.restart ends the session...fresh: true, once...` test failed (`the mark is gone once the fresh start is made`, `true !== false`); reverted.
- Mutation 4: changed the handoff staleness comparison `> last` to `>= last` in `handoff-extension.ts` → `at a start only a handoff newer than the last one read is read...` test failed; reverted.
- All four mutations caught by existing tests; worktree confirmed clean (`git status --short`) before verdict.
- Cross-checked every Delivers/Done-means/edge-case clause of roadmap entry 36 (`spec/roadmap.md:344-358`) against `restart.ts`, `handoff-extension.ts`, `request.ts`, `session.ts`, `coordinator.ts`, `orchestration.ts` and their tests/docs — each is implemented and covered.
- Ticket Decisions (`spec/features/AR0144-.../ticket.md`) match the diff exactly: line-budget raises, `freshAt` default, 120 s wait, notice shape, renamed `request.json`, coordinator role sentence.

PASS
