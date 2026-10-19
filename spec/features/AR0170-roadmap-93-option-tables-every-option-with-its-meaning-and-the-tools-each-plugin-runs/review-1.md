# AR0170 - Review 1

- Job: 2026-10-19-review-ar0170-d7aadb58
- Branch: h/2026-10-19-ar0170-74fefb69
- Commit reviewed: d7878e2dc5a6f510e2b4a833b390cc2cd5b13c9f
- Verdict: PASS

## Final message

Reviewed AR0170 branch (orchestration plugin option tables + core walker + 5 more plugins' options files) against ticket Done means and roadmap entry 93.

**Findings:** none blocking.

**Notes (non-blocking, already self-disclosed in `findings.md` as F1/F2 by the worker):**
- `packages/orchestration/src/orchestration-options.ts:34` (F2): `table.roles.each = role` publishes `thinking` and a list-capable `model` for every role, but the real check special-cases `roles.quick` with a separate, narrower `quick` table (model-only, string-only) that the published table doesn't reach. `everyOption` never lists `roles.quick.model`/`.thinking`, so the new structural test can't catch the mismatch. Pre-existing special-case (not introduced by this diff), narrow (one role name), transparently filed as F2, and the `each` shape (which can't express a per-item override) was approved by the owner's Decision in the ticket.
- Various files (F1): a `default` string is prose beside the code's literal default; nothing asserts they agree except orchestration's `maxAgents`/`plan`/`autopilot` (built from shared constants). Risk for future drift and for `arthur setup` (94), filed as open, out of this ticket's tested Done means.

**Checks run (in this worktree, not the main checkout):**
- `npm ci` — clean.
- `npm run check` (tsc) — clean, no errors.
- `npm test` — 552/552 pass, 0 fail (matches worker's claim).
- Mutation 1: dropped the `each` branch in `everyOption` (core/src/option-table.ts) → 2 of 4 `test/option-tables.test.ts` tests fail (matches worker's claim), restored via `git checkout --`.
- Mutation 2: injected a stray `debugFlag` into orchestration's unknown-key message without adding it to `table` → 1 test fails ("each package's check refuses an unknown option...") (matches worker's claim), restored via `git checkout --`.
- Smoke: `arthur config check` against a config with `core.jobs.nope`, `cpu: 0`, `quietHours` missing `to` → printed all three refusals with paths, exit 1 (matches worker's claim); temp files removed, worktree left clean (`git status --short` empty).
- Verified package boundaries: no plugin options file imports another plugin; only `test/option-tables.test.ts` (repo-root test, not inside any package) imports across plugins, consistent with existing `test/structure.test.ts` precedent and the rule that only applies inside `packages/`.
- Verified new/changed files all ≤200 lines (largest: `orchestration-options.ts` 139, `schedule-options.ts` 117).
- Verified `package.json` diffs only add `./options`/`./option-table` export entries, no `dependencies` added.
- Verified existing option-check test files (core, orchestration, projects, machines, resources, session, schedule) are untouched in the diff — old wording/paths/order preserved by construction, confirmed by the full pass.
- Verified README/`arthur.mmd` entry-93 counts (23 of 27 core entries; 1-22 + 93) arithmetically consistent with roadmap's core entry list; the "mermaid block is arthur.mmd, unchanged" test passed.
- Verified ticket's Decision chain: worker's open decision in this branch is resolved by an owner-confirming Decision already on `main`, approving tables for all six plugins, the `each` shape, and the line-budget raises "buying only these tables."

PASS
