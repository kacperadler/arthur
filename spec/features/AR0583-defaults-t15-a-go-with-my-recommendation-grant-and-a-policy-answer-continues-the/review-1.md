# AR0583 - Review 1

- Job: 2026-10-30-review-56ada27c
- Branch: arthur/2026-10-30-worker-6d2278ad
- Commit reviewed: 9e5b85e88c96fb85a258bdc4618b13fb58079390
- Verdict: FAIL

## Final message

**AR0583 review: FAIL.** The grant lets `arthur take-main` go through on the coordinator's own recommendation, and two of the new continue-by-policy guards survive mutation. The checks pass and the line budgets match what AR-D378 accepted.

## Findings

1. **`packages/orchestration/src/silent.ts:46`: a grant hands `arthur take-main` to the coordinator (security; this is F2, which I reproduced rather than inferred).**
   - `byRecommendation` turns down only asks that are class proposals, budget questions, or carry `--what`. A merge ask with no `--what` gets answered `by recommendation`.
   - `decision.owner` only turns down `by policy:` answers (`decision-use.ts:41` uses `policyOf`), so it takes a recommendation answer as the owner's own.
   - Throwaway test on the fake host, deleted afterwards:
     - Ran `silent on … --until 23:00 --recommend`, then `decision ask --kind merge --question 'Take main as it is?' --option 'Take it' --recommend 1`.
     - That printed `AC-D1 answered by recommendation (G1): Take it`.
     - Then `call("decision.owner", { id: "AC-D1", what: "arthur take-main", kind: "merge", use: "take-main acme 0000abcd" })` returned `""`, meaning allowed.
   - `decision.md:85` and AR0355/AR0441 say only the owner's recorded decision lets take-main through. The branch ships a way around that, and AR-D378 asks for a grant to be in force right after the merge.
   - The test comment at `silent.test.ts:315`, "a merge naming no flag lets none through", is false for take-main.
   - Smallest fix: `refusal` also turns down `by recommendation:` answers, plus a row in `decision-use.test.ts`. `decision-use.ts` is outside the Scope list, so the final message should say why it was touched.
2. **`decision-hooks.ts:35`: the once-only guard is never tested.** With `if (… === "EEXIST") return;` deleted, all four target test files still pass (0 fail).
   - The "continued once" test (`decisions.test.ts:820`) replays the events only after the job's state has already moved on, so the `blocked` check stops the second call, not the marker.
   - In a real race, the core's `continuing` lock (`job-control.ts:98`) would reject the second continue. The coordinator would then get a false "was not continued by policy" message.
3. **`decision-hooks.ts:40`: the case where `jobs.continue` resolves with a reason is never tested.** I replaced `failed === undefined || told(failed)` with `true`: 0 fail.
   - The only refusal test hits the rejection path.
   - A wrapper that does not start (`jobs.ts:87` documents that it resolves with the reason) would then never reach the coordinator, and the job stays blocked with nobody told.
   - The worker says every condition it broke made a test fail; findings 2 and 3 are two conditions where none does.

## Notes (not blocking)

- **Budgets:** orchestration 2568 and models 516 are what AR-D378 accepted.
  - No source line goes past the ticket. The extra lines are the grant's argument parsing and bound checks, its line in the context, the `job-ended` continue for jobs a plugin holds in their run, and the message to the coordinator when a continue fails.
  - `decision-log.ts` is exactly 200 lines.
- **Keeping the grant memory in the handoff until F3: safe, and the right call.**
  - The handoff is not a repository file, so this branch could not delete that memory anyway.
  - `roles/coordinator.md:60-66` never mentions `--recommend`. Deleting the memory first would leave the coordinator nothing that tells it to record a grant.
  - The plan's item "Deletes the grant memory in the handoff" therefore waits on F3, a one-clause role change.
- **Treating every kind `budget` question as a `--budget 0` ask: safe, and needed.**
  - `decision-use.ts:20,39` accepts any answered `budget` question of the job's ticket for `--budget 0`, and nothing on an ask marks it as `--budget 0`.
  - A narrower refusal would let a budget question the grant answered unlock unlimited spend.
  - The cost: line-budget raise questions wait for the owner.
- **F1** (a recommendation answer can back a class, `decision-class.ts:27`) is real but limited: the class proposal still needs the owner's approval. It should be fixed together with F2, the same `by recommendation:` check.
- Commit `9e5b85e8` is titled `test(…)` but also changes source. The final message says so.

## Checks run

- `npm ci`: exit 0.
- `npm run check` then `npm test`, in one call: tsc clean; 1359 tests, 1297 pass, 0 fail, 62 skipped. This matches the worker's numbers, and nothing in `limits.test.ts` failed.
- Throwaway take-main test: bypass confirmed (finding 1). An `--unreviewed` merge with an ask the grant answered is still turned down: "lets through no merge flag".
- 27 mutations, each run against `silent.test.ts`, `decisions.test.ts`, `inbox.test.ts` and `models.test.ts`:
  - **Caught:** each refusal (budget, class, `--what`), `until <` changed to `<=`, `usage <` changed to `<=`, the ticket bound, no bound at all, usage 0 and 101, `models.usage` missing, a bound without `--recommend`, a flag given twice, the grant id check, the hand-edit check, a recommendation answer even when two classes match, no recommendation at all, the `hold`/`blocked`/policy checks, the continue on ask and the continue at `job-ended`, the failed-fetch check, `Math.max` changed to `Math.min`, and the empty-window case.
  - **Survived:** M20 (EEXIST return removed) and M23 (failure on the resolve path ignored).
  - One mutation did not apply because the text did not match.
  - Every file was restored with `git checkout`; `git status` is clean.
- `git grep "Act on it" -- packages`: no match, so the old wake line is gone.

FAIL