# AR0228 - Review 1

- Job: 2026-10-20-review-ar0228-roadmap-51-41ae1c06
- Branch: h/2026-10-20-ar0228-roadmap-51-freeze-619539f1
- Commit reviewed: a7b043bd370b51794b1b3ce6d4d3829a586464f2
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

## Findings

None blocking.

## Notes

- `packages/core/src/wrapper.ts:62` comment ("a job a plugin holds is `blocked` until `unblock`") is now stale — `unblock` was removed by this branch, but `wrapper.ts` isn't in this diff's range, so it's a pre-existing/incidental doc-rot, not a finding against this change.
- `test/structure.test.ts`'s new comment breaks the core's +16 budget raise into additions summing to 31 and cuts summing to 14 (net +17), one off the actual +16; immaterial since the structure checker independently measured 5684 actual source lines against the 5684 budget (verified directly below), so the test itself is correct regardless of the comment's arithmetic.

## Checks run (in this worktree, against `7ebb63f64f75db2fc8253d91f6c76c7e4c310b5d..a7b043bd370b51794b1b3ce6d4d3829a586464f2`)

- `npm ci`: installed clean (16 packages).
- `npm run check` (tsc): exit 0, no output.
- `npm test`: 778/778 pass, 0 fail — matches the worker's claim exactly.
- Ran `checkStructure` directly with a zero core budget: confirmed actual core source-line count is exactly 5684, matching the raised budget in `test/structure.test.ts` precisely (no slack either way).
- Mutation: deleted the `jobs.result` row from `docs/plugin-api.md` → `test/plugin-api.test.ts`'s host-table test fails with a diff naming `jobs.result` extra. Restored.
- Mutation: added an unlisted export `takeLock2` to `packages/core/src/lock.ts` → the module-exports test fails with a diff naming `takeLock2`. Restored.
- Mutation: removed the `keys: { quick: ... }` entry from `roles` in `packages/orchestration/src/orchestration-options.ts` → `test/option-tables.test.ts`'s "an option two levels deep..." test fails, missing `roles.quick`/`roles.quick.model` — matches the worker's claimed test result exactly. Restored.
- Grepped the whole tree for `unblock`/`board.after(`: only `arthur ticket after` (`ticket-command.ts`) and the core's own `board.test.ts` (which now imports `board` from `../src/board.ts` directly, not through a plugin host) still use `after`; no plugin calls `jobs.unblock` or `host.board.after`. Confirms the Done-means claim that both were unused by any plugin.
- Confirmed via `package.json` exports and `npm run check` passing clean that `asPlugin`, `pluginStep`, `registry`, `pluginHost`, `Registry` (moved to the unpublished `plugin-host.ts`) and `envRefusal` (moved to the unpublished `env-refusal.ts`) are referenced by no plugin — a stale plugin import of either would have failed `tsc`.
- Verified every plugin/test file that previously rebuilt a type via `Parameters<Host[...]>` (`commit-rules/hook.ts`, `commit-rules.test.ts`, `board-commands.ts`, `plan-file.ts`, `install.ts`, `telegram/commands.test.ts`, `youtrack.test.ts`) now imports the named type (`Prepare`, `Command`, `Filing`, `Job`, `SpawnRequest`) from `@arthur/core/plugin` — clean cutover, no leftover `Parameters<Host[...]>` pattern.
- Confirmed README/`arthur.mmd` both mark entry 51 built and link `docs/plugin-api.md`; the existing "README's mermaid block is arthur.mmd, unchanged" test passed in the full run above.
- `git status --short`: clean after all throwaway mutations were reverted.

PASS
