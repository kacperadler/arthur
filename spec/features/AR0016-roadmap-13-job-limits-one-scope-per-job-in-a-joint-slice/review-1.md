# AR0016 - Review 1

- Job: 2026-10-16-review-ar0016-one-scope-9538e03b
- Branch: h/2026-10-16-ar0016-one-scope-per-job-d48b552c
- Commit reviewed: 9d888f55268d50d9a99e84f328383c2db931e27a
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

Findings: none blocking.

Notes (non-blocking):
- F1 (`systemd-run` failure after slice setup leaves a job unended) is honestly recorded in `findings.md` as `open`, with a concrete suggestion (entry 15's sweep, or waiting on `systemd-run`'s exit). Correctly out of scope for this ticket per the finding's own "Out" line.
- `config.test.ts`'s systemd cross-check (`TAKEN`/`REFUSED` against real `systemctl set-property`) only runs when a user manager is reachable; on CI without one it still exercises the pure-JS `memoryMax` boundary table, which is the one Done-means item that matters.

Checks run (in this worktree, not the main checkout):
- `npm ci`: clean.
- `npm run check`: clean (`tsc`).
- `npm test`: 227/227 pass.
- `systemctl --user list-units --all | grep arthur`: no `arthur-jobs`/`arthur-job-*`/`arthur_test_*` units survive the suite (only unrelated harness `h-*` scopes present).
- Mutation checks (each applied via throwaway `sed` edit, run, then restored with the backed-up file, confirmed by `git diff --stat` showing no change afterward):
  - Removed `endScope(id)` at normal job end → `scope.test.ts`'s "a job that forks a daemon leaves nothing running…" fails (daemon still runs).
  - Removed `endScope(id)` in `leave()` (deleted-record path) → "a record deleted while the job runs kills the daemon…" fails.
  - Forced `launch` to always report "bare" (simulating no systemd reachable) → three scope tests fail (no `arthur-jobs.slice`, daemon survives in both forking tests).
  - Inverted `memoryMax`'s lower bound (`bytes >= 1n` → `>= 0n`) → the memory boundary test fails on `0`/`0K`/`0%` being wrongly accepted.
  - Disabled the test kit's exit-time slice `stop`/`revert` → `testing.test.ts`'s slice-cleanup test fails (slice stays `active` with its `MemoryMax` drop-in); one leftover `arthur_test_*` slice from this deliberate mutation was removed afterward (`systemctl --user stop/revert`), confirmed gone.
- Re-ran full `npm test` after all restorations: 227/227 pass again, worktree clean.

All Done-means points from the ticket/roadmap entry 13 and the task's Focus line are met: per-job `arthur-job-<id>.scope` inside one slice with `CPUQuota`/`MemoryMax` from `jobs.cpu`/`jobs.memory`; leftovers killed before `state` is written, same on a deleted record; bare run with exactly one log line when no user manager; config refuses the systemd-invalid memory values (verified against real `systemctl` too); tests use their own random `arthur_test_<hex>` slice, never `arthur-jobs`, and leave nothing behind; the per-spawn slice-limit write is idempotent across concurrent spawns (same joint config values, synchronous JS section, no interleaving) so there is no real race; F1 honestly filed; `jobs.ts` at 200, `wrapper.ts` at 190, `job-scope.ts` at 70 — all under budget, no budget raised. Docs (`docs/deploy.md`, `spawn.md`, `arthur.config.example.ts`) updated to match.

PASS
