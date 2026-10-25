# AR0394 - Review 1

- Job: 2026-10-25-review-ar0394-remote-pus-eb61e4ab
- Branch: h/2026-10-25-ar0394-remote-push-confi-a2787f57
- Commit reviewed: fa08371dc4b9358d48fd2740dd9cad636b14d7a6
- Verdict: PASS

## Final message

## Review: AR0394 — remote push config hardening

### Findings
None that block merge.

### Verification performed

**Ticket compliance** (`spec/features/AR0394.../ticket.md` at `main`):
- Done means: `arthur remote-job repo` refuses before any push when `configRefusal(root)` of the repository there is non-empty → implemented exactly (`remote-job.ts:36-37`), mirrors `addWorktree`'s existing pattern.
- "Fetch back and prune not covered by this; check each for the same keys" → fetch investigated and documented (no code change needed, `git upload-pack` runs no such key — test confirms `existsSync(ran) === false` after a fetch with `core.alternateRefsCommand` set); prune found vulnerable and fixed (`remote-job.ts:83-85`), checking `configRefusal(worktree)` only while the worktree still exists (since a gone worktree triggers `git worktree prune`, which runs no `git status`).
- Decision for the line-budget raise (6073→6081) recorded in `ticket.md`, matches `git diff --numstat` (+8/-1 remote-job.ts, +2/-1 job-machine.ts).
- F1 finding (local-machine prune, `job-records.ts:151`, same bug class) correctly scoped out — ticket's "In:" scope names only `arthur remote-job repo`/prune-there, not local prune. Verified the code at that line indeed has no `configRefusal` check, confirming the finding is accurate, and `Status: open` with correct template formatting.

**Checks run in this worktree** (not the main checkout):
- `npm ci` — clean.
- `npm run check` (tsc) — clean, no errors.
- `npm test` — 1096/1096 pass, 0 fail (matches worker's claim exactly).
- `machine.test.ts` alone — 36/36 pass.

**Mutation testing** (each applied via `sed`, run against `machine.test.ts`, then `git checkout --` to restore):
1. Repo refusal disabled (`if (false) throw …`) → caught: `assert.rejects` message mismatch (push already happened in this path, but the discrepancy against the expected `repo` refusal message fails the test). Separately verified with a standalone probe script that without the `repo`-step check, `git receive-pack` already runs the malicious `core.alternateRefsCommand` script before the later `add`-step check can catch it — confirms this is a real, not cosmetic, security gap that the `repo` check closes.
2. Prune refusal forced to `""` → caught: worktree is actually removed/branch deleted, contradicting the expected "kept" message.
3. Prune checks `configRefusal(root)` instead of `configRefusal(worktree)` → caught on the `config.worktree`-scoped sub-case, as the worker's table states.
4. `present ?` guard dropped (unconditional `configRefusal(worktree)`) → caught: fails on the "worktree already gone" case with a git `fatal: cannot change to …` stderr message — confirms the real (unmutated) code never surfaces this version-dependent git stderr text, since the guard conditions it out. This directly satisfies the task's "Focus" instruction: the new tests' expected strings are all composed by Arthur (deterministic file paths, lower-cased keys, fixed templates), never copied from git's own stderr in the paths actually exercised.

**Docs**: `remote-job.md`, `spawn.md`, `prune.md`, `deploy.md` (threat model) all updated consistently with the new refusal messages and behavior; `job-machine.ts` comment above `reach` updated to reflect the new check. No boundary violations (core-only diff, no plugin touched), no secrets, no production resource names, no public listeners, no non-English text.

### Notes (non-blocking)
- F1's suggested fix (apply the same guard to local prune in `job-records.ts`) is reasonable follow-up but correctly left for a separate ticket per `h merge`'s findings workflow.

PASS
