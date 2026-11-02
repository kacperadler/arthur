# AR0562 - Review 2

- Job: 2026-11-02-review-3b6d9ca3
- Branch: arthur/2026-10-29-worker-868301bd
- Commit reviewed: ba83ccec2988f93e8f7df55b572b868865e9c907
- Verdict: PASS

## Final message

I found no blocking findings. Review-1's only finding is fixed: `propose.tmp.ts` is gone, and commit `ba83ccec` does nothing but delete those 43 lines. `git status --short --untracked-files=all` on the tip printed nothing.

Every point under the ticket's "Done means" is in the diff:
- **The command:** `arthur repeats` takes `--project`, `--since` and `--retro`, and wrong usage exits 2.
- **The digest:** it lists decisions by kind and by who answered, then the repeated shapes. Each shape names its covering class and gives either a ready `class propose` line or the reason no class fits. Standing grants, the owner's overrides, loose class matches and the recurring issues from ticket history follow.
- **`/repeats`:** it sends a page in the report style, red only for the overrides and loose matches. `/repeats retro` and `--retro` start the existing retro kind, and the retro's prompt gets the digest of its period.
- **Roles and criteria:** they allow `Kind: class` asks and the code-default exception.
- **Coordinator role:** it gets its one line.
- **orchestration:** it provides `decision.entries`, and a test covers its refusals.

## Notes
- (minor) `test/structure.test.ts:27-33`: line budgets raised. manage goes from 931 to 1262 (+331, the ticket estimated about +190) and orchestration from 2434 to 2440. As you asked, I judged the code, not the raise; it is your open decision AR-D444.
- (minor) `packages/manage/src/repeats-issues.ts`: this file is not in the Scope's list. It is split out of `repeats.ts`, which keeps both files green (73 and 157 lines).
- (minor) `packages/manage/src/repeats-command.ts:39`: usage line. `--since` with `--retro` exits 2 with the general usage line, which does not say the two cannot be combined. The worker says the docs describe this.

## Checks run
- `npm ci`, then `npm run check`: tsc passed.
- `npm test`: 1320 tests, 1258 passed, 0 failed, 62 skipped. This matches the worker's numbers.
- Two hand mutations of `packages/manage/src/repeats.ts`, each restored with `git checkout`, `git status` clean afterwards:
  - Dropping `&& !own` from the standing-grant test: `repeats.test.ts` caught it (1 test failed).
  - Changing `picks > 1` to `picks > 2` in `candidate`: caught (1 test failed).
- `npm run mutate`: not run. The script does not exist on this branch's base, and per your instruction that does not count against the branch.

PASS