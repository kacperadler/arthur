# AR0242 - Review 1

- Job: 2026-10-21-review-ar0242-merge-chec-fe635cba
- Branch: h/2026-10-21-ar0242-merge-checks-use-d43ff86c
- Commit reviewed: 0ba172259b7853e837ad7885e71f50edeaab4571
- Verdict: PASS

## Final message

Worktree clean, at the reviewed commit.

**Findings:** none that block merge.

**Notes:**
- `nodePath` shared between the job `prepare` and the new `nvm.path` provider is a reasonable, non-premature reuse (identical exit-code decoding, two real call sites) — not a styleguide violation.
- Worker correctly flagged `arthur merge --help` doc-print as `[INFERENCE]` (no `arthur.config.ts` in this worktree); unchanged infra, not this ticket's concern.

**Checks run (in this worktree, against `7083a4d..0ba1722`):**
- `npm ci` — 20 packages, clean.
- `npm run check` (`tsc`) — no errors.
- `npm test` — 866/866 passed, 0 failed (matches worker's claim).
- Mutation 1: removed `if (PATH !== "") env = { ...env, PATH }` in `merge-checks.ts` (PATH answer ignored) → `merge.test.ts` new test fails (3 assertions false vs true). Caught.
- Mutation 2: disabled the "Node not installed" refusal (`ran.code === 6`) in `nvm.ts`'s shared `nodePath` → both `nvm.test.ts`'s new `nvm.path` test and the pre-existing prepare-refusal test fail. Caught; confirms the shared function isn't a silent regression surface.
- Mutation 3: swapped `host.collect` for `host.call` on `nvm.path` in `merge-command.ts` (would throw when no nvm plugin provides it, instead of leaving PATH as-is) → multiple pre-existing `merge.test.ts` tests (which never register `nvm.path`) fail. Confirms "without the plugin, PATH as it is" is genuinely tested, not just by the one new test.
- All mutations reverted (`git checkout --`), worktree confirmed clean and at `0ba1722`.

Diff matches ticket's Goal, Done means, and Decisions (budget raises nvm 85→96, delivery 770→777, exact numbers and exact comment placement in `test/structure.test.ts`). `nvm.path` recorded in `docs/plugin-api.md` (Changes-since-51 entry + Provided-names table row) and in `packages/nvm/docs/nvm.md`/`packages/delivery/docs/commands/merge.md`. No files touched outside scope. `roles/coordinator.md` unchanged as claimed.

PASS
