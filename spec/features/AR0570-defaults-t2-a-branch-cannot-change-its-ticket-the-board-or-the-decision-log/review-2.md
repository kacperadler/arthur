# AR0570 - Review 2

- Job: 2026-10-30-review-e1475616
- Branch: arthur/2026-10-30-worker-0bc169b2
- Commit reviewed: f6ebad62a44ffa82aa4b46ff6f6e84c99f16c166
- Verdict: PASS

## Final message

I found no change to a `ticket.md`, `spec/decisions.jsonl` or `spec/build.json` that gets past `merge.check`. All three findings from review 1 are fixed, each mutation from review 1 is now caught, and `npm run check` and `npm test` pass in my checkout.

### Findings
None that block the merge.

### Attempts to get a change past `merge.check`
I ran these against the plugin on the fake host, in a temporary repository, then deleted the probe file:

| Attempt | Result |
|---|---|
| Three merge bases: the worker merges two siblings and main, puts back sibling 1's `ticket.md`, then main merges both siblings | refused |
| Directory rename `AC0001-shop/` → `AC0001-store/` | refused, both ticket paths named |
| `spec/build.json` replaced by a symlink | refused |
| Mode change (`chmod +x spec/decisions.jsonl`) | refused |
| Conflict in `spec/decisions.jsonl` | refused |
| `main..arthur/w` as the branch name | refused: "cannot tell what merging …" |
| The same change made on main and on the branch | passes, correctly: the merge changes nothing |
| `findings.md` replaced by a symlink to `ticket.md` | passes the check, but no harm: findings and outcome are written to a temporary file and renamed (`findings-file.ts:46-47`, `on-merge.ts:67-68`, `merge-outcome.ts:60-61`), so the rename replaces the link and never writes through it |
| `Ticket.md`, `Spec/build.json` | pass; on Linux these are separate files, not the ticket or board |

On a git older than 2.38, `merge-tree --write-tree` prints no tree. The check then refuses with "cannot tell …", so it fails closed.

### Notes
- **A symlinked ticket folder passes:** a branch can add `spec/features/AC0002-forged` → `../../docs/forged`, holding `docs/forged/ticket.md`. The ticket is not on the board unless `build.json` changes, which is refused, but its folder now counts toward the next ticket id. Worth a finding.
- **Case:** on a case-insensitive file system (macOS), `Ticket.md` would pass both the guard and the check and still reach the real ticket. [INFERENCE] The same note was in review 1.
- **Guard:** the routes listed in review 1 (`cp -t`, `git checkout <ref> -- <file>`, `git apply`, `rm -r` of the folder…) still get past the guard. `merge.check` on the branch stops them, and the worker's final message now says so accurately.
- **Plan wording:** the plan says the check diffs `main...tip`; the branch builds the merge's tree instead. The worker's message gives the reason (review 1's finding 1), and the "after" order test fails when the old diff is put back.
- **Budgets:** core +2, delivery +3, orchestration +29, against the plan's +3, +3 and +25. You said AR-D355 allows measured raises, and the structure test passes with these numbers.
- **Git objects:** `merge.check` now writes unreferenced trees and blobs into the project's object store each time it runs; `git gc` removes them.
- **Commit messages:** they have no `(AR0570)` scope. Not a blocker under the review criteria.
- **Open findings:** F1 and F2 in `findings.md` are still open; neither is in this ticket's scope.

### Checks run
- **`npm ci`, `npm run check`, `npm test`:** `npm ci` exited 0 and `tsc` printed no errors. The first `npm test` result was lost because my filter matched none of its summary lines, so I ran it again alone with a 1800 s timeout: tests 1341, pass 1266, fail 0, skipped 75, exit 0. These match the worker's numbers. Nothing in `limits.test.ts` failed.
- **Mutations**, each run against its test file and restored with `git checkout --`; `git status` was clean afterwards. All 14 are caught:

| Mutation | Result |
|---|---|
| Guard `$` dropped (review 1, M1) | fail 1 |
| Guard `^` dropped | fail 1 |
| Guard refusal turned off | fail 1 |
| `-z` dropped (review 1, M2) | fail 4 |
| `refusals.length > 0` → `> 1` (review 1, M3) | fail 1 |
| `merge.check` never asked in `review-needed` | fail 1 |
| Blank answer counted as a refusal | fail 1 |
| Ticket regex broken (review 1, M4) | fail 4 |
| `$` dropped in the paper-check regex | fail 1 |
| Tree line check replaced by the exit code | fail 1 |
| Old `HEAD...branch` diff put back | fail 1 |
| Check run for every job kind, not only workers | fail 1 |
| `--no-renames` dropped | fail 1 |
| `paperCheck` not registered | fail 4 |

PASS