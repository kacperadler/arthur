# AR0163 - Review 1

- Job: 2026-10-18-review-ar0163-7d8ba09d
- Branch: h/2026-10-18-ar0163-a0544f1a
- Commit reviewed: b0b21021002f9264d2a2abdc617570c325d8ddf1
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

**Findings:** none that block merge.

**Notes (non-blocking):**
- F1/F2 in `findings.md` are correctly scoped `open` risk/improvement for later entries (65, 64, 72); they don't affect entry 40's own completeness and are explicitly deferred per the worker's message.
- AR0162's fix (absolute `.md`-in-package-folder check, double-guarded by `normalize(procedure) === procedure` and the `sep`-bounded `startsWith`) is solid; verified by mutation.

**Checks run (in this worktree, on commit `b0b2102`):**
- `npm ci`: clean install, 11 packages.
- `npm run check`: passes, no tsc errors.
- `npm test`: 542/542 pass (full run, ~220s).
- Mutation testing on key behaviors, each restored via `cp`/`git checkout` after:
  - Removed `normalize(procedure) === procedure` in `register.ts` → caught (the `roles/../report.md` traversal test fails).
  - Removed `sep` boundary in `procedure.startsWith(`${folder}${sep}`)` → caught (the `${manage}-other/report.md` sibling-folder test fails).
  - Disabled the symlink-detection branch in `sweep.ts`'s `procedureText` → caught (both `registered.test.ts` and `schedule.test.ts` symlink tests fail, and the mutated run actually leaks the symlinked `secret.md`/`not for the coordinator` text into a coordinator message — confirms the trust boundary is real, not decorative).
  - Disabled `remove`'s refusal of a registered entry (`made !== undefined` → `false`) → caught (remove silently deletes a registered id instead of refusing).
  - Removed the `<plugin>.` id-namespace prefix in `register.ts` → caught (two tests expecting `manage.report`/`manage.audit` ids fail).
- Confirmed `@arthur/core/lock` addition is exports-only (one line in `packages/core/package.json`), no core source touched — matches worker's claim.
- Confirmed schedule's new files (`register.ts` 43, `entry-file.ts` 62, `schedule-command.ts` 127 lines) stay under 200 lines each; `wc -l packages/schedule/src/*.ts` totals 497, matching the `test/structure.test.ts` budget (277→497, decision recorded in ticket).
- Confirmed plugin-boundary rule: schedule's new/changed files import only `@arthur/core`, `@arthur/core/plugin`, `@arthur/core/lock`, node builtins, and sibling files in `packages/schedule/src/` — no cross-plugin or core-internal-path imports; `structure.test.ts`'s own boundary tests pass.
- Confirmed README/`arthur.mmd`/`arthur.config.example.ts`/coordinator role doc changes match the worker's description; `docs/schedule.md` moved to `docs/commands/schedule.md` and is 103 lines, printed by `--help` (wired via `new URL(...)` in `schedule.ts`).
- Confirmed `fakeHost.call`/`provide` in `core/testing.ts` dispatch through the real `pluginHost`/event-name registry, not a mock echo — the new `registered.test.ts` exercises real plugin-to-plugin registration semantics.

All of entry 40's Done-means points (registered-id clash refusal, `remove` naming the owning plugin/option, `add` time validation, `list` showing source+next-run, disabled-plugin entries vanishing) are implemented and covered by tests that fail when the behavior is mutated or removed. AR0162's procedure-path risk is closed with a boundary that keeps the config/file relative-path rule untouched, as the ticket demanded.

PASS
