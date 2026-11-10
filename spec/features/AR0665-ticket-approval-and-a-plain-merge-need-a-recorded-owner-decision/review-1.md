# AR0665 - Review 1

- Job: 2026-11-10-review-c77071b9
- Branch: arthur/2026-11-10-worker-1ca8d870
- Commit reviewed: 520aad649465df0b8107950c21d08fd2ce0ab424
- Verdict: FAIL

## Final message

**Verdict: FAIL.** The new gate works and is well tested, but the docs and the messages delivery sends still tell the coordinator to run a bare `arthur merge <job>`, a command this branch now refuses.

## Findings

1. **`packages/delivery/docs/commands/merge.md:37`, `:39`, `:43`, `:55`: the merge page still gives the old command.** These lines document the `--auto` refusals and the coordinator wakes as ending with `its merge(s) wait for the owner: arthur merge <job> on his word`. After this branch, a plain `arthur merge <job>` with no `--decision` is refused (`arthur merge <job> needs the owner's decision: …`).
   - The branch edited this page itself, and `merge.md` is in the ticket's Scope In. The review criteria fail any doc line that still says what the branch changed, in a file the Scope's Out does not name.
   - The messages these lines document are in delivery's code: `auto-merge.ts:30`, `auto-merge.ts:48`, `ci-wait.ts:87`, `pass-forward.ts:83`. The tests that pin them are `auto-merge.test.ts:132,208,225,337` and `review.test.ts:744,752`, and the eval is `packages/delivery/evals/review-pass-hook/scenario.json:3,10`. They still send the coordinator to that bare command.
   - The worker filed this as F1 and left it, with no owner approval to cut scope. F1's own suggestion lists `merge.md` and the eval as needing the update.
   - The fix is small: end each line with `arthur merge <job> --decision <the owner's decision id>`, as `auto-merge.ts:61` already does for `--no-ci`.

Everything else matches the ticket's Done means:
- **Moving a ticket to planned:** `ticket-command.ts:50` asks `decision.owner` by name, with `kind: "plan"` and the ticket's id.
- **Plain merge:** `merge-command.ts:129` asks the owner for every merge except `--auto`.
- **Plan approval lines:** `plans.ts` accepts a line only when its decision id is in the log as a `plan` question of this ticket. Its last answer must carry the owner's message and approve the same commit.
- **Other routes to planned:** the only other code that moves a ticket to `planned` is autopilot (`orchestration/src/autopilot.ts:78`). Status names are matched exactly (`board.ts:116`), so a spelling like `Planned` cannot get around the check.
- **Policy and recommended answers:** neither carries `message` (`decision-classes.ts:49`, `silent.ts:51`), so the check in `plans.ts` also refuses them.

## Notes
- (risk) packages/orchestration/src/decision-use.ts:61: any answered plan decision lets a ticket move to planned, even a "no". `decision.owner` never reads the answer's text. So an owner's "Plan the ticket again: …" on a plan question (`plan-ended.md` step 5), or a "no" to a ticket approval, still lets `arthur ticket status <id> planned --decision <id>` through. For a `- Plan: yes` ticket, `plans.ts` still blocks the worker; for any other ticket, nothing does.
- (risk) packages/orchestration/src/decision-use.ts:61: one approval can set a ticket `planned` more than once. The same `planned <id>` move passes again, so a ticket moved back to `planning` returns to `planned` on the old answer. The worker states this cost, but `ticket.md` does not.
- (minor) packages/orchestration/docs/commands/silent.md:22: the list of merge questions the grant never answers names only `--unreviewed`, `--no-ci` and `take-main`, not the plain merge's question. "Kind `merge`" still covers it.

## Checks (all on 520aad64)
- `npm run check && npm test` (one call): tsc reported no errors; 1687 tests, 1623 pass, 0 fail, 64 skipped. This matches the worker's numbers.
- `npm run mutate`: `25 mutants, 25 caught, 0 survived; 142 not run (--max 25)`.
- Hand mutations, each run against its own test file and restored with `git checkout --`; the tree was clean afterwards. Every one was caught (1 test failed each time):
  - `plans.ts`: dropped the `message` check, the ticket check, the commit check and the kind check; replaced `if (!proved)` with `if (false)`; changed `answers.at(-1)` to `answers[0]`.
  - `decision-use.ts`: narrowed `/^(merge|planned) /` to `/^merge /`; dropped `what.startsWith("--")`.
  - `merge-command.ts`: removed the plain merge's request; removed `mode.auto ? []`.
  - `ticket-command.ts`: made the owner check unreachable; disabled the `throw` on refusal.
- `npx arthur ticket --help` prints the `--decision` form (5 matching lines). Running `arthur ticket status` itself was refused inside this review job, so I could not smoke-test that command.

FAIL