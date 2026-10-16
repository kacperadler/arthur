# AR0024 - Review 1

- Job: 2026-10-16-review-ar0024-jobs-on-an-fa2f08b6
- Branch: h/2026-10-16-ar0024-jobs-on-another-m-bc3c12f4
- Commit reviewed: a6f20a71a328c9214be06dd158a71e5fe1f8dcd8
- Verdict: PASS

## Final message

Clean. Final assessment.

**Findings:** none blocking.

**Notes (non-blocking):**
- `packages/core/src/job-control.ts`: `continueJob` still calls `launch()` (local) unconditionally and checks `existsSync(worktree)` against a remote-style path, so `arthur continue` on a job whose `machine` isn't `local` fails with the misleading `its worktree was pruned` instead of a message naming the machine. Pre-existing code path, not a regression from this diff; worker's final message correctly flags that `continue`/`stop`/`steer`/`prune` on another machine are entry 22's job, and this doesn't break anything reachable from entry 21's spawn flow.
- `host.jobs.run` doesn't re-verify the remote `arthur` version on each call (only `reach()`, used by spawn, does). Consistent with the ticket's wording for `run` (no version-check requirement stated) and avoids an extra SSH round trip per `prepare` step.
- Test words for the quoting check (`a b`, `it's "quoted"`, `$HOME`, empty, `; touch hacked`) don't include a literal backtick or newline; the single-quote wrapping (`quote()`) is correctness-proven for every byte except embedded `'`, which is escaped, so this is a coverage gap, not a security hole.
- F1/F2 in `findings.md` are genuine, correctly scoped non-blocking risks, not disguised unfinished work.

**Checks run (in this worktree, on commit a6f20a7, base a5fe69b7):**
- `npm ci` — ok.
- `npm run check` (`tsc`) — exit 0, no errors.
- `npm test` — 299/299 pass, matches worker's claim.
- Line budget: `find packages/core/src -name '*.ts' ! -name testing.ts ! -name fake-agent.ts | xargs wc -l` → 4345 total; at base commit a5fe69b7 → 4049; growth for this ticket = 296, within the 350-line allotment for entry 21 for `structure.test.ts`'s budget of 4812. `jobs.ts` is exactly 200 lines (passes the ≤200 rule).
- Mutation test: replaced `quote()` in `job-machine.ts` with the identity function (disabling shell-quoting of `argv` words) and reran `node --test packages/core/test/machine.test.ts`: the new `jobs.run` test fails (`Unterminated quoted string`), 11/12 pass, 1 fail — confirms the quoting is load-bearing and caught by the test suite. Restored the file afterward (`git checkout --`), `git status` clean.
- Verified `host.jobs.run` is wired through `Jobs`/`JobRunner`/`plugin.ts` consistently and reaches `fakeHost` for free (same `jobRunner`/`pluginHost` code path used by real host), so no plugin-facing mock drifted out of sync — test `jobs.run runs one command on a machine ...` exercises it via `fakeHost({ name: "projects" }).host.jobs.run`.
- Verified docs (`spawn.md`, `plugin.ts`'s `Jobs`/`Host` doc comments) match the implementation: BatchMode/StrictHostKeyChecking flags present on every SSH call (`OPTIONS` constant shared by `ssh()` and `run()`), unknown-machine and bad-argv refusal messages match code and tests, local path runs via `spawn()` with no shell.
- Confirmed the merge of `main` (roadmap Decision (a) edit) is in the range as commit `01c3b04`, and the ticket's Decision (a) text matches the shipped `host.jobs.run` signature and behavior exactly.

All Done-means points for entry 21, decision (a)'s behavioral contract, and the follow-up's specific asks (run on local/remote, quoting test, exit-code pass-through, docs) are met, verified by running the real checks rather than trusting the worker's report.

PASS
