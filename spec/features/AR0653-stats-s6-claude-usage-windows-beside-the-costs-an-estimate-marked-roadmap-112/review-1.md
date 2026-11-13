# AR0653 - Review 1

- Job: 2026-11-13-review-31754ff2
- Branch: arthur/2026-11-13-worker-6d262270
- Commit reviewed: 87e8c94ee22f3a867f6a43adc49ee065c0f69720
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0653 and section 5 / S6 of the AR0480 plan ask, from start to finish. `usage.ts` keeps `durationMs`, `models.ts` provides `models.windows`, and `windows.ts` adds `arthur stats windows`. Each role's share is marked `≈` and the header says it is an upper bound. The pages for the command and for `models.windows` are written, and `README.md`, `docs/setup.md`, `arthur.mmd`, `arthur.config.example.ts` and `docs/plugin-api.md` are updated. A search found no text left saying "usage windows planned".

- **Plan tests:** the three "How to test" cases for 112 are all covered by `packages/stats/test/spend.test.ts`: a window with a span, one without `resetsAt`, and one with no report. The tests also cover the refusals (`windows extra` exits 2, inside a job exits 1), the start of a window's span to the millisecond, the provider filter, and the order of roles that tie.
- **Mutate survivors:** all 6 are equivalent mutants.
  - `at: 0` changed to `±1`: only a line dated at 1970 or earlier would change.
  - In the sort's tie comparator (`windows.ts:33`): `<=` matters only when two roles have the same name, and `Map.groupBy` gives each role once. `-2`/`2` keep the sign. Returning `0` instead of `1` changes nothing, because V8's binary insertion sort only tests `order < 0` on lists this short.
- **Line budgets:** models goes from 537 to 546 (+9, the plan said +10) and stats from 531 to 575 (+44, the plan said +50); the final message names both. Every changed source file stays under 200 lines.
- **Boundaries:** stats reaches models only through `host.collect("models.windows")` and imports nothing from models. No runtime dependency or class is added.
- **Worker's claims:** the checks, the files and the run as a user all match what I saw.
- **Ticket files:** there is no `findings.md` on the branch for this ticket.

## Notes
- (bug) packages/stats/src/windows.ts:28: a time outside the range `Date` accepts crashes the view. With `resetsAt` 179455663696508407 in `usage.json`, `host.clock.local(new Date(start))` throws. `arthur stats windows` then prints `arthur stats: Invalid time value` and exits 1, while `arthur usage` prints the same report (seen in a temporary folder). A report with an impossible reset or length should get a "no span" line instead.
- (risk) packages/stats/src/windows.ts:29: a window for one model tier (`tier: true`, e.g. `Claude 7 Day (fable)`) that has a `durationMs` is compared with the spend on all of that provider's models. Its role shares then include spend that this window does not count.
- (minor) packages/stats/src/windows.ts:29: when one provider has two accounts, each account's windows count the provider's whole spend.
- (minor) spec/features/AR0480…/plan.md:213: the plan's Risks say a raise of the models budget is written as a decision in its ticket. AR0653's Decisions section is empty. The worker pointed this out, and the ticket's Done means asks only for the final message to name it.

## Checks (all on 87e8c94e)
- `npm run check`: tsc passed with no errors.
- `npm test`: 1817 tests, 1753 pass, 0 fail, 64 skipped.
- `npm run mutate`: 100 mutants, 94 caught, 6 survived, 1 not run (`--max 100`). The 6 survivors are `windows.ts:23` ×2 and `windows.ts:33` ×4, the ones the worker listed; all are equivalent, as explained above.
- Mutations by hand, each tried against its package's tests and restored with `git checkout`; each made 1 test fail:
  - `durationMs > 0` → `>= 0` in `usage.ts`
  - `failed !== undefined` removed from `models.ts`
  - provider filter removed from `windows.ts`
  - `resetsAt ?? now` → `now` in `windows.ts`
- Run as a user in a temporary folder (orchestration, models and stats, a fake `omp`, two runs in `runs.jsonl`), folder removed afterwards:
  - `arthur stats windows` exited 0 and printed `- anthropic Claude 7 Day 40% used, since 2026-11-07 07:57: $4.00; worker 75% ≈ 30%, review 25% ≈ 10%` and `- anthropic Claude 5 Hour 10% used: the report gives no span`.
  - `arthur stats windows extra` exited 2 and printed `usage: arthur stats windows`.
  - `arthur stats windows --help` printed `# arthur stats windows`.
- `git status --short` is empty after the restores.

PASS