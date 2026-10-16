# AR0062 - Review 1

- Job: 2026-10-16-review-ar0062-no-spawn-d-de1961c6
- Branch: h/2026-10-16-ar0062-no-spawn-during-s-5718213a
- Commit reviewed: 5869a6b21d684d5028197b47ac9e0130f5c7730a
- Verdict: PASS

## Final message

## Review: AR0062 — refuse `host.jobs.spawn` during a plugin's `setup`

### Verification of the fix

**`plugin.ts`** (`pluginHost`): `spawn` is a plain (non-async) arrow function that throws synchronously before calling `runner.spawn`, so an un-awaited spawn in `setup` fails the load rather than causing an unhandled rejection — matches the Done-means wording exactly: `"<plugin>: spawn during setup; start jobs from start() or later"`.

**`host.ts`** (`loadPlugins`): `loading` is set `true` before the setup loop, every `pluginHost(...)` call shares the same closure (so plugin A's host still throws while plugin B's `setup` runs), and `loading = false` is placed after `refuseUnstartableTickets`/`moveStartedTickets` are registered. Since the function throws before reaching that line on any `setup` failure, a failed load never clears the flag — correct per-call scoping (no cross-call leakage since `loading` is a local `let`).

**`testing.ts`** (`fakeHost`): new `FakeHost.setup(plugin)` sets `loading = true`, runs `plugin.setup(host)` via `Promise.try(...).finally(() => (loading = false))`, clearing on both success and throw. File is exactly 200 lines (base was 195, diff is +10/−5, minimal — `let loading = false, following = false;` reuses one declaration line rather than two; nothing further shrinkable without losing clarity).

**Tests added**: `host.test.ts` covers (a) a plugin spawning in its own `setup` without awaiting, (b) a later plugin (`schedule`) spawning through an earlier plugin's host (`orchestration`) during its own `setup`, and confirms no job record/worktree/branch exists, then that a post-load spawn reaches the real job runner (`"the task is empty"`). `testing.test.ts` adds the matching fake-host case, plus verifies a spawn *after* a failed `fake.setup` succeeds (proving the `.finally` clears `loading` even on throw).

### Mutation testing (performed in this worktree, reverted after each)

- Disabled the `loading()` guard in `plugin.ts` → exactly 2 tests failed, 26 passed (matches worker's claim).
- Commented out `loading = false;` in `host.ts` → the real-load "spawn after load" assertion failed with the refusal message instead of `"the task is empty"` (1 fail, matches claim).
- Changed `fakeHost`'s `.finally(() => (loading = false))` to `.then(...)` (so the flag never clears on a thrown `setup`) → the new "spawn after setup goes on" assertion failed, confirming the test actually exercises the clear-on-throw path, not just the happy path.

All three mutations were caught by the existing tests; working tree restored clean after each (`git status --short` empty).

### Checks run myself

- `npm ci` — installs cleanly (5 packages).
- `npm run check` — `tsc` passes, no errors.
- `npm test` — 243 tests, 243 pass, 0 fail (matches the worker's claim exactly).

### Scope / boundaries

- `jobs.ts` untouched (AR0017 non-collision honored as instructed).
- `host.ts` diff confined to 3 lines inside `loadPlugins` (33–47 region), as claimed.
- No plugin/core boundary violation: all changes inside `@arthur/core`'s own `src/`; `testing.ts` is the package's own published testing export.
- `spec/roadmap.md` host-API paragraph updated with the new refusal and its line — matches styleguide's doc-update expectation for host API changes.
- Core `src/` total: measured 3850 lines (worker claimed 3851 — rounding/trailing-newline difference, immaterial) against the 4000 budget; not exceeded. `testing.ts` sits exactly at its 200-line file cap, not over.
- No new runtime dependency, no class/enum, no `index.ts`/`types.ts`/`utils.ts` introduced.

### Notes (non-blocking)

- None beyond what's already covered; the diff is a minimal, surgical fix matching the ticket's Decisions (refuse at spawn time, don't reorder the check; `fake.setup(plugin)` added as the Coordinator explicitly approved).

No findings that block merge.

PASS
