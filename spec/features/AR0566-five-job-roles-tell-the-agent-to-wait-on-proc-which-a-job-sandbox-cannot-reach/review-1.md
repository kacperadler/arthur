# AR0566 - Review 1

- Job: 2026-10-30-review-5cf3245c
- Branch: arthur/2026-10-30-worker-1f9e4a41
- Commit reviewed: 596aed5011c5c1f5285fcf7a405bf5a34ca67a42
- Verdict: PASS

## Final message

No findings: the branch meets every Done means point of AR0566.

- **Roles:** none of `reviewer.md`, `auditor.md`, `retro.md`, `planner.md` or `plan-reviewer.md` mentions `proc://` or `sleep 30` any more. Each has the worker's timeout rule word for word: across `worker.md` and the five roles, `sort | uniq -c` counts the identical rule line 6 times.
- **Never lists:** the "Never end the turn while a command you started still runs" lines now say "Wait for it, then write the … from its output". The auditor and retro still say a final message that promises to wait has no proposals.
- **`launch` key:** `packages/core/src/job-omp.yml` is unchanged. The ticket allows that when a real `omp -p --config` run does not confirm the key, and the worker's final message shows that run. The owner confirmed this.
- **Diff:** the diff matches what the worker reported: 9 files (5 roles, 4 test files), +35/−7, one commit `596aed50 fix(AR0566): …` in Conventional Commits form with the ticket id as scope. No `src/` file, line budget or dependency changes.

## Notes
- The new checks read each spawned job's real `prompt` file, so they test what an agent actually receives, not the role file on disk.
- Old review files under `spec/features` still describe polling `proc://`. They are history, outside the range.

## Checks
- `npm ci`, then `npm run check && npm test` in one bash call with a 1800 s timeout: `tsc` reported no errors. My filter on the test output found no summary lines and its `grep` ended the call with exit 1, so I ran `npm test` again alone (1800 s timeout): tests 1322, pass 1260, fail 0, cancelled 0, skipped 62. This matches the worker's numbers. No timing test in `limits.test.ts` failed.
- Mutations, each run with `node --test` on its own test file and restored with `git checkout -- <file>`; `git status --short` was clean afterwards. Every one was caught:

| # | Mutation | Test file | Result |
|---|----------|-----------|--------|
| M1 | rule line deleted from `retro.md` | `retro.test.ts` | fail 1 |
| M2 | `proc://` put back into the Never line of `plan-reviewer.md` | `plans.test.ts` | fail 1 |
| M3 | rule line deleted from `reviewer.md` | `review.test.ts` | fail 1 |
| M4 | `sleep 30` put back into the Never line of `auditor.md` | `audit.test.ts` | fail 1 |
| M5 | rule line deleted from `planner.md` | `plans.test.ts` | fail 1 |
| M6 | `1800` changed to `1700` in `retro.md` | `retro.test.ts` | fail 1 |

PASS