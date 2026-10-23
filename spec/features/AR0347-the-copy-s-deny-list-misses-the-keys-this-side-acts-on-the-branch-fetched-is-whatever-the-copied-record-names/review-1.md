# AR0347 - Review 1

- Job: 2026-10-23-review-ar0347-copied-rec-7a3e1618
- Branch: h/2026-10-23-ar0347-copied-record-36d985f1
- Commit reviewed: ccd70c57b6998edc3b6707199fb025aec55529d8
- Verdict: PASS

## Final message

Worktree clean, all mutation edits restored.

**Checks run**
- `npm ci`: clean.
- `npm run check` (tsc): clean, no output.
- `npm test`: 1060 tests, 1060 pass, 0 fail (run in this worktree, matches worker's claim exactly).
- Mutation A (restore old `OWN` deny-list): fails the new allow-list test with `project` overwritten to `other` and a fetch attempted against the attacker-named (nonexistent) repo `other.git` — reproduces the exact vulnerability the ticket describes.
- Mutation B (remove the branch-refusal loop): fails the branch-refusal test exactly as claimed (`Missing expected exception`).
- Mutation C (fetch target reverted to `read("branch")`/dynamic refspec instead of hardcoded `arthur/${id}`): all 29 tests still pass — correctly benign, because the branch-check loop already forces local `branch` to be `arthur/<id>` or empty before this line runs, and `branch`/`project` are excluded from `RUN` so can never be the attacker's value. Matches worker's own disclosure of this non-exploitable surviving mutation.
- Diff stat matches worker's claim exactly: 3 files, +78/−11.
- `machine-sync.ts` is 119 lines, well under the 200-line file budget; structure/line-budget tests pass in the full suite.
- Doc (`spawn.md`) text verified against the actual allow-list and refusal message in code — verbatim match, no drift.

**Findings:** none that block merge.

**Notes**
- The branch-refusal check is strictly defense-in-depth once `branch` is excluded from the allow-list (local `branch` can no longer be attacker-influenced), but it is exactly what the ticket's Done-means and test description ask for, and the worker's final message is accurate about why the one surviving mutation is safe. Not a finding.

PASS
