# AR0091 - Review 1

- Job: 2026-10-17-review-ar0091-ssh-epipe-16081a65
- Branch: h/2026-10-17-ar0091-ssh-epipe-985f8960
- Commit reviewed: facbf3af8be0f5b529426bf553b0f9b1c9851ee9
- Verdict: PASS

## Final message

Branch verified end-to-end against ticket AR0091.

**Findings:** none.

**Notes:**
- The extra `code === "EPIPE"` specificity (beyond `status !== null`) is effectively redundant in practice: verified empirically that `ENOENT`, `EACCES`, and `ENOBUFS` (maxBuffer overflow, which kills via `SIGTERM`) all leave `status === null` in Node 24's `spawnSync`, so `status !== null` alone already excludes them. Not a defect — the explicit EPIPE check matches the ticket's prescribed fix verbatim and is harmless extra precision.
- Diff is minimal and scoped exactly to `ssh()`; `sshAsync()`/`execute()` untouched (already handled this per the ticket). No boundary, shape, or scope violations.

**Checks run (in this worktree, against `9822fef..facbf3a`):**
- `npm ci`: clean.
- `npm run check` (`tsc`): no errors.
- `npm test`: 4 full runs, `330/330` pass each time (no flakiness observed, matching worker's claim that the pre-fix flake is gone).
- `node --test --test-name-pattern="offline mid-job|not EPIPE"`: both pass.
- Reverted the fix to the pre-fix `if (run.error !== undefined) throw …` and reran the new test: it failed exactly as the worker's final message describes — `actual: Error: machine gpu: ssh: spawnSync ssh EPIPE` vs expected ssh's `Permission denied (publickey)` line. Confirms the test is a real regression check, not a tautology. Restored the fix (`git diff` clean afterward).
- Mutation: widened the guard to swallow *any* spawn error whenever `status !== null` (dropping the EPIPE-code check) — full suite still 330/330 (no test distinguishes this), but empirically no real `spawnSync` failure mode sets both `error` and non-null `status` except EPIPE-on-already-exited-child, so this isn't an exploitable gap; restored.
- Focus-specific check: with the real fix in place, pointed `PATH` at a nonexistent directory so `ssh` itself is missing (`ENOENT`, `status === null`) and called `ssh()` directly — it still throws `machine gpu: ssh: spawnSync ssh ENOENT`, confirming non-EPIPE spawn errors are not swallowed.
- `git status --short` / `git diff --stat`: clean after all throwaway mutations reverted.

PASS
