# AR0227 - Review 1

- Job: 2026-10-20-review-ar0227-uptime-plu-b28972ce
- Branch: h/2026-10-20-ar0227-uptime-plugin-f319c5fb
- Commit reviewed: d29d2f9c7acc89e513aff14202ef04d46b149438
- Verdict: PASS

## Final message

Worktree clean, two Conventional Commits with ticket scope AR0227, matches expected shape.

---

**Findings:** none that block merge.

**Notes (non-blocking):**
- F1 (fetch's blocked-port list causing permanent "bad port" false-down) is correctly left `open` in findings.md rather than fixed inline — consistent with the findings workflow (becomes a planning ticket at merge).
- F2 (sites as plugin option vs. project-list key) is the Focus item; coordinator already accepted it — not FAILing on it per instruction.

**Checks run (in this worktree, against `480173a..d29d2f9`):**
- `npm ci`: clean, 17 packages.
- `npm run check` (tsc): no errors.
- `npm test`: 792/792 pass, 0 fail, 248 s — matches worker's claim exactly.
- `node --import @arthur/core/testing --test "packages/uptime/test/*.test.ts"`: 15/15 pass, matches claim.
- Line counts (`wc -l`): site-check.ts 41, uptime-options.ts 72, uptime-state.ts 34, uptime.ts 141 → 288 total, matches `structure.test.ts` budget and the worker's claim exactly.
- Mutation testing (throwaway edits, reverted with `git checkout --` each time, worktree confirmed clean after):
  - `FAILS = 2 → 1`: caught by "a 500 that answers 200 at the second check is no notice" (asserted no notice, mutation produced down+up notices).
  - Disabled the stranger-project refusal (`throw new Error(...)` → no-op): caught by "a key of sites that is not a project refuses the load" (expected rejection, got none).
  - Disabled `readState` restore on restart (`begin` always empty state): caught by both restart tests (duplicate down notice, `2 !== 1`).
  - Offline min-sites guard `>= 2 → >= 1`: caught by "a slow answer past the timeout fails the check" (single-site case now wrongly reported as machine-offline instead of per-site down).
  - Removed the "already down" early-return guard (`site.down !== undefined || site.fails < FAILS`): caught by the restart test (`4 !== 1`, repeat down notices).
  - All five mutations were caught by the existing test suite; none slipped through.
- Confirmed README/`arthur.mmd`/`arthur.config.example.ts`/`spec/roadmap.md` diffs match the ticket's Done means and Scope; option table entry present and checked by `test/option-tables.test.ts`; `host.folder` (own `.arthur/uptime/` folder) used for state, no cross-plugin folder access; no cross-plugin imports (only `@arthur/core/plugin`, `@arthur/core/option-table`, `@arthur/core`, host API `collect("projects")`); no runtime dependency added (`package.json` has none); example project names (`acme-shop` etc.) reuse the existing config's placeholders, no real client leak.

PASS
