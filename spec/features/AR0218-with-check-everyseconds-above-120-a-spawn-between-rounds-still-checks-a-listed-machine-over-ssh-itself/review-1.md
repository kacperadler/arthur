# AR0218 - Review 1

- Job: 2026-10-19-review-ar0218-small-pair-94b251ca
- Branch: h/2026-10-19-ar0218-small-pair-2117a1a3
- Commit reviewed: 6aad75389e3d07df2af497deca1be5ccbc41b498
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

---

**Findings:** none blocking.

**Notes (non-blocking):**
- `packages/resources/test/room.test.ts:265` tests the round-cadence formula only at `everySeconds: 300`; it doesn't add a case below 120 s even though the ticket's evidence mentions the regression appears "above 120." The formula (`2 * (sample.everySeconds ?? CHECK_SECONDS)`) is generic and uniform for any value, so the 300 s case already exercises the same code path a sub-120 value would use; mutating the formula (removing `sample.everySeconds ??`) is caught by the existing test regardless of the specific value tested. Not a gap worth failing on.
- `packages/schedule/src/register.ts`'s new refusal checks `own` is one of `code.slice(1)` but doesn't verify it's *this* plugin's own folder vs. another plugin's — a plugin could in principle pass a different plugin's folder from `code` and it would be accepted. Not exploitable in practice (a plugin only has its own `host.package`, not another's), and the ticket only asks to stop using the by-name lookup, which this does.

**Checks run (in this worktree, against the given range):**
- `npm ci` — clean install, 16 packages.
- `npm run check` — `tsc` clean, no errors.
- `npm test` — 738/738 pass, 0 fail (matches worker's claimed count).
- `git diff --stat 146a6f0..6aad753` — 15 files, +95/−54, matches worker's claim.
- Mutation: `room.ts` `fresh()` reverted to ignore `sample.everySeconds` (back to flat `CHECK_SECONDS`) → new round-cadence test fails (7 ssh calls vs expected 3). Caught.
- Mutation: `machine-free.ts` `readSample` dropped the `everySeconds` validity check → hand-broken-cadence sub-case fails (2 vs expected 3 ssh calls). Caught.
- Mutation: `machines.ts` dropped the `everySeconds` arg from `host.collect("machines.round", …)` → cadence assertion fails (`undefined` vs `300`). Caught.
- Mutation: `register.ts` reverted to `basename(folder) === plugin` name lookup → 3/9 `registered.test.ts` tests fail exactly as the worker described (scoped-package-name test, procedure-refusal test, symlink test).
- Mutation: removed the new `own`-folder refusal guard in `register.ts` → "Missing expected exception" on the refusal test, as claimed.
- Mutation: `host.ts` dropped `package: packages[index]` from the per-plugin host object → `host.package` assertions in `host.test.ts` fail (all become `undefined`).
- Confirmed `test/structure.test.ts` (line budgets) has zero diff in the range — budgets genuinely unchanged, matching the worker's claim that edits were trimmed to fit.
- Confirmed no production caller of `schedule.register` exists yet (`grep` across `packages/*/src`), so the added third argument needed no caller migration — matches worker's claim.
- Both commits present, Conventional Commits with ticket-id scope, `Signed-off-by` trailer on each; worktree left clean, nothing pushed.

Diff stays inside each ticket's named scope (schedule's register/host hand-over for AR0219; machines/resources round-cadence plumbing for AR0218), with docs updated to match (`docs/commands/machines.md`, `docs/resources.md`, `docs/commands/schedule.md`). No plugin-to-plugin imports, no core→plugin import, no new runtime dependency, no file over 200 lines, no classes/enums introduced. Tests follow the existing patterns (fake host, virtual clock via `setNow`, no fixed-time sleeps in new assertions).

PASS
