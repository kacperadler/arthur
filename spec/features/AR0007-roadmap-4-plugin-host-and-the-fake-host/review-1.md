# AR0007 - Review 1

- Job: 2026-10-16-review-ar0007-ar0007-roa-419ffd0e
- Branch: h/2026-10-16-ar0007-ar0007-roadmap-4-53516d96
- Commit reviewed: 4e38ef501b55d66c96e3ce7cd0dbe930555b66e6
- Verdict: PASS

## Final message

All verified. Final assessment.

**Findings:** none that block merge.

**Notes (non-blocking):**
- `plugin.ts:60` duplicates `describe()` from `host.ts` and `env.ts`'s `kind()` (same shape, different name) — intentional per styleguide's "duplicating a short function is cheaper than a helper bag," not a problem.
- F1 (open finding, `config check` skips host refusals) is correctly scoped out: `config-check.ts` isn't touched by entry 4, and the worker documented it transparently rather than silently leaving the gap or over-reaching into entry 6/8's territory.

**Checks run (in the review worktree, `4e38ef5`):**
- `npm ci` — clean.
- `npm run check` — passes, exit 0.
- `npm test` — 62/62 pass, matching the worker's claim.
- Mutation tests (each applied, run, reverted, `git status --short` confirmed clean after):
  - Removed the `orchestration`-required check → `orchestration is required…` test failed as expected.
  - Disabled the cycle `loop` short-circuit in `setupOrder` → cycle test failed (stack overflow, still a failure, caught).
  - Disabled the duplicate-provider refusal in `registry().call` → "two plugins provide" test failed as expected.
  - Made `enabled` filter include disabled plugins → "disabled plugin is not loaded" test failed (hit the disabled plugin's `check` that calls `assert.fail`).
  - Disabled the `ARTHUR_`/`TMUX` clearing in `testing.ts` → the tmux-isolation test failed by actually reaching this machine's live tmux session `h` (session `h: 1 windows…` printed), confirming the safety net is load-bearing, not just mocked.
- Spot-read `host.test.ts`/`testing.test.ts` against every refusal/edge case the Focus section lists (missing/disabled `orchestration`, missing/disabled required plugin, `requires` cycle incl. self-cycle, duplicate names, `call` with none/two providers, throwing `check`/`setup` naming the plugin, `collect` empty, disabled plugin env/folder/check never touched, fake host drives both provide and call sides, `Host` type exposes only `name/options/env/folder/provide/call/collect`) — each has a dedicated test, and the npm test run above shows all green.
- Shape/boundary: `host.ts` 119 lines, `plugin.ts` 76, `testing.ts` 68 — all under the 200-line file cap and the core's 4000-line budget (unraised, untouched `structure.test.ts`); no runtime `dependencies` added; no class/enum; `exports` adds only `./plugin` and `./testing`, `.` unchanged; no plugin exists yet so no boundary violation is possible, and the new structure-test coverage (pre-existing, unmodified) already fences future plugins against `@arthur/core/testing/<deeper>` and core-internal paths.

PASS
