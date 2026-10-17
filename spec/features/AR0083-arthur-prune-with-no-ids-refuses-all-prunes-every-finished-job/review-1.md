# AR0083 - Review 1

- Job: 2026-10-17-review-ar0083-aea841ff
- Branch: h/2026-10-17-ar0083-9f8db889
- Commit reviewed: 74302aaaab191274e2bea1d23a0b9a7e4666644c
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

Findings: none that block merge.

Notes:
- The exit-2-for-empty-id choice (vs. exit 1 "like an unknown id") is the right call: every other usage refusal in this codebase exits 2, and treating the empty-id case as a usage error rather than a lookup failure is consistent with that convention and with Done-means bullet 4's explicit "exit 2."
- `arthur ticket new ""` and `arthur ticket after "" <id>` still accept an empty word (not covered by the ticket's named command list, which is `prune`, `stop`, `steer`, `continue`, `ticket status`); out of scope as the ticket names it, correctly left alone.
- `jobUpkeep().prune([])` (F1 finding) still widens to every finished job; correctly logged as an open finding rather than fixed, consistent with the ticket's Out-of-scope line ("What Git or `jobs.keep` keeps") and with no plugin path reaching it today.

Checks run (in this worktree):
- `npm ci`: clean install, 6 packages.
- `npm run check` (`tsc`): clean, no errors.
- `npm test`: 337 pass, 0 fail — matches worker's claim exactly.
- Mutation: disabled `words.includes("")` guard in `job-commands.ts` → 4 tests fail (stop/steer/continue/prune-empty-id), matching worker's claim; restored.
- Mutation: disabled bare-prune guard (`all === undefined && ids.length === 0`) → 1 test fails, matching worker's claim; restored.
- Mutation: disabled `--all` + ids conflict guard → 1 test fails (not explicitly claimed by worker but a key behavior; caught); restored.
- Mutation: removed `id !== "" && status !== ""` guard in `ticket-command.ts` → `cli.test.ts`'s new ticket-status test fails (worker said this test "was not mutated" by them, but it does catch the mutation when I ran it); restored.
- Verified `jobs.prune([])` in `job-records.test.ts` still tests the old wide-prune behavior directly, matching F1's claim.
- Verified `Jobs` type in `jobs.ts` exposes no `prune` to plugins, matching F1's claim.
- All mutated files restored (`git status --short` clean).

PASS
