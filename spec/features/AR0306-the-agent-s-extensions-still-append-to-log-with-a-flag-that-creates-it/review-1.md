# AR0306 - Review 1

- Job: 2026-10-22-review-ar0306-0b8bbb8b
- Branch: h/2026-10-22-ar0306-26b82e6d
- Commit reviewed: 02c4ae61c6fdf98488e3169ba4318ce42b660162
- Verdict: PASS

## Final message

Scope is tight: exactly the two source files the ticket names, their tests, and the budget-recording test. No unrelated changes.

Findings: none.

Notes:
- Worker's final message flags a "needs action" item (budget-raise approval), but `main`'s ticket already carries that Decision line (dated 2026-10-23, "Coordinator (free hand): line budget raise accepted, core 5755 to 5770"), so the approval the worker asks for is already on record. Not a blocker.
- `worktree-guard.ts`'s flag-mutation (dropping `O_WRONLY`) fails with `EBADF` rather than recreating `log`, not quite the failure mode the worker's table implies, but it still fails the exact tests the worker names, so the claim's end result is accurate.

Checks run (in this worktree, not the main checkout):
- `npm ci`: clean, no output.
- `npm run check`: tsc, no errors.
- `npm test`: 1042 tests, 1042 passed, 0 failed — matches worker's claim.
- Mutation `steer.ts`: removed the `code !== "ENOENT"` rethrow guard (swallow-all) → new steer test fails (`Missing expected exception`, expected `EISDIR`). Restored via `git checkout`.
- Mutation `worktree-guard.ts`: removed `if (said) return;` → "said once" test fails (`2 !== 1`). Restored.
- Mutation `worktree-guard.ts`: changed flag from `O_WRONLY | O_APPEND` to `O_APPEND | O_CREAT` → both the new fallback test and "a project declared while a job runs…" fail with `EBADF`. Restored.
- Tree confirmed clean (`git status --short`) after each restore.

Diff matches the ticket's Done means verbatim: open without `O_CREAT`, write, close, skip on `ENOENT`, rethrow otherwise, no retry path added. Tests use real temp folders (`temporaryFolder()`), cover both the missing-log and log-as-directory edge cases, and would fail if the behavior were removed (confirmed above). Line-budget raise is explained with a per-file `git diff --numstat` breakdown and already has its ticket Decision line, per AR0300's precedent.

PASS
