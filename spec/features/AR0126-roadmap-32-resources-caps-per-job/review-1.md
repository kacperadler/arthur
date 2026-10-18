# AR0126 - Review 1

- Job: 2026-10-18-review-ar0126-resources-a29b97b7
- Branch: h/2026-10-18-ar0126-resources-per-job-eaa337bc
- Commit reviewed: 9450b106b6ed6fe61a3f5016596d59b3a881a729
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

**Findings:** none that block merge.

**Notes (non-blocking):**
- `job-record.ts`, `job-control.ts`, `remote-job.ts` carry caps transparently through `Job & Caps` without explicit new code in `add`/`launch` steps — minimal diff, correctly relies on existing JSON/record plumbing.
- `resources.ts`'s `Caps` type duplicates `job-scope.ts`'s `Caps` shape; correct given the plugin/core boundary (no shared type export), not a defect.

**Checks run (in this worktree, against `748674c..9450b10`):**
- `npm ci` — clean install, 8 packages added.
- `npm run check` (`tsc`) — no errors.
- `npm test` — `node --test` across all packages: **403 tests, 403 pass, 0 fail, 0 skipped**, matching the worker's claimed result. Confirmed `needsManager`/systemd-scope tests actually ran (not skipped) on this host.
- Mutation checks (throwaway edits, reverted with the backups and verified `git status` clean afterward), per the task's Focus:
  - Removed the `systemd >= 253` gate in `ownLimits` (job-scope.ts) → always emit `OOMPolicy=continue`: caught by `scope.test.ts`'s "a systemd older than 253 ... gets the memory cap without it" (fails).
  - Disabled the no-scope memory-poll trip condition in `job-memory.ts` (multiplied threshold by 1000) → caught by `scope.test.ts`'s "without a user manager a job over its memory cap is stopped within one 10 s sample" (times out, fails).
  - Removed the `cpu > core.jobs.cpu` refusal in `resources.ts`'s `checkOptions` → caught by `resources.test.ts`'s "a per-job cap above the joint core.jobs.cpu or core.jobs.memory is refused at load" (fails).
  - Dropped `config.core` from the `plugin.check?.(options, config.core)` call in `host.ts` → caught both by `tsc` (arity error) and `host.test.ts`'s "each plugin checks its own options ... with the core's as loaded" (fails).
- Verified: `resources` package exactly 42 source lines (matches the recorded budget exactly, no padding); core's structure-test budget raise (4649→4691, +42) is recorded as a ticket Decision (commit `9450b10`); `arthur.config.example.ts`, `spawn.md` ("Caps per job"), `remote-job.md` (`uncapped:` line), `packages/resources/docs/resources.md`, README/`arthur.mmd` ("in progress, 1 of 4 entries") all updated and consistent with the code.
- Verified plugin/core boundary: `resources.ts` imports only `@arthur/core`'s published `.`/`/plugin`/`/testing` exports, never a core path; core never imports the plugin; `resources.test.ts` uses `fakeHost`/`fakeAgent` from `@arthur/core/testing`, never a real plugin.
- Verified test hygiene: all new scope/resources tests run in the kit's `jobSlice` (`arthur_test_<random>`), never the production `arthur-jobs` slice; kit's `process.on("exit")` stops/reverts it.

PASS
