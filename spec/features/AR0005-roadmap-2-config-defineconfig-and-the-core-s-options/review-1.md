# AR0005 - Review 1

- Job: 2026-10-16-review-ar0005-config-def-cf9675ac
- Branch: h/2026-10-16-ar0005-config-defineconf-feee6814
- Commit reviewed: 48a3d2062a612ce43b7c9bc13549e7bcf3d2b685
- Verdict: PASS

## Final message

**Findings:** none that block merge.

**Notes:**
- `arthur.config.example.ts` still lists `jobs.idleMinutes`/`jobs.offlineGraceMinutes`, which `loadConfig` would refuse as unknown options if actually loaded today. No current test or command loads this file (tsconfig excludes it from `tsc`, and `node --check` is syntax-only), so this is inert, consistent with AR0001's note that the example isn't type-checked yet; the worker flagged it and it belongs to roadmap entries 16/22, out of this ticket's scope.
- `packages/core` line budget (4000, `test/structure.test.ts`) is unaffected by the 155-line `config.ts`; well under any limit.

**Checks run (in this worktree, range `5fe79778..48a3d206`):**
- `npm ci` — succeeds (no lockfile change needed; `package.json` only added `exports`, no deps).
- `npm run check` (`tsc`) — passes, clean.
- `npm test` — 25/25 pass, matching the worker's claim.
- Read full diff of `packages/core/src/config.ts`, `packages/core/test/config.test.ts`, `packages/core/package.json`, `arthur.config.example.ts` against roadmap entry 2's Done-means list and the ticket; every named edge case (unknown option naming path+choices, wrong type naming path+expectation+value, unknown time zone, non-`HH:MM` quietHours including a missing `to`, negative budget/timeout refused, `0` accepted, missing file naming path, throwing/syntax-error file naming file+error, defaults for all nine options incl. `cpu = cores-1 (min 1)` and `memory = "70%"`) has its own test, confirmed by reading `config.test.ts` in full.
- Mutation testing (throwaway `sed` edits in this worktree, each reverted via `cp` of a saved backup, confirmed restored with `diff -q` before re-running `npm run check`):
  1. Removed unknown-option push → 2 tests fail.
  2. `atLeastZero` turned into always-true (negative accepted) → 2 tests fail.
  3. `atLeastZero` turned into `> 0` (budget/timeout `0` refused) → 2 tests fail.
  4. `quietHours.to` wrapped in `optional` → 1 test fails.
  5. Removed `existsSync` missing-file throw → 2 tests fail.
  6. `knownZone` check replaced with always-true → 2 tests fail.
  All six mutations of key refusal/default behaviors are caught; no mutation silently passed.
- Confirmed via `git status --short` the worktree is clean after mutation testing (no leftover edits).
- Boundary/shape check: `config.ts` imports only `node:*` built-ins, no runtime deps added (`package.json` has no `dependencies` key), file is 155 lines (under 200), no `index.ts`/`types.ts`/`utils.ts`, no class/enum, English only, no secret values, no network listener introduced.
- Diff stays within AR0005 scope: `packages/core/src/config.ts` (new), `packages/core/test/config.test.ts` (new), `packages/core/package.json` (exports field), `arthur.config.example.ts` (comments only) — nothing touches other packages or `spec/roadmap.md`.

PASS
