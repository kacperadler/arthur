# AR0583 - Review 2

- Job: 2026-10-30-review-b404e8e7
- Branch: arthur/2026-10-30-worker-6d2278ad
- Commit reviewed: 2f7073939dd765ea4fbe529e45898a90901ebb8e
- Verdict: PASS

## Final message

## AR0583 review, round 2

The three findings from review 1 are fixed, each fix is caught by its tests when I break it, and the full suite passes.

## Findings

None that block the merge.

- **Finding 1, the `arthur take-main` bypass, is fixed in two places.**
  - `silent.ts:44`: `byRecommendation` now turns down every ask of kind `merge`, alongside `class` and `budget`. The test at `silent.test.ts:316` covers it: a merge ask that names no flag, the shape `arthur take-main` asks, now comes back unanswered (`AC-D3`).
  - `decision-use.ts:44`: `refusal` turns down a later answer that was given by recommendation. `decision-use.test.ts:104` covers take-main, `--unreviewed` and `--budget 0`.
  - The false test comment from review 1 is gone.
- **F1, a recommendation answer backing a class, is fixed.** `decision-class.ts:29` refuses it, tested at `silent.test.ts:328`.
- **Finding 2, the once-only guard, is now tested.**
  - At `decisions.test.ts:818`, the replayed events now reach the hook while the job is still `blocked`.
  - The test also checks that no event handler logged a failure (`decisions.test.ts:820`).
  - So the marker, not the job's state, is what stops the second continue.
- **Finding 3, a continue that resolves with a reason, is now tested.**
  - `decisions.test.ts:895` puts stub `systemctl` and `systemd-run` in a temporary folder at the front of PATH; the stub `systemd-run` refuses to start.
  - The coordinator gets the reason and the `arthur continue` command, and the job ends `failed: …`.
  - PATH is put back by the `t.after` in `acmeJob`, and no production name is used.
- **The +7 orchestration lines are only the refusals.** Between the round-1 tip `9e5b85e8` and `2f707393`:
  - `decision-class.ts` +2: an import and the refusal.
  - `decision-use.ts` +2: an import and the refusal.
  - `silent.ts` +3: the `recommendedBy` helper with its comment, plus one more comment line where the `merge` check took over from the `--what` check.
  - Models stays at 516. `test/structure.test.ts` sets orchestration 2575 and models 516, as AR-D381 accepted.

## Notes (not blocking)

- **The grant now turns down every `merge` question, not only those with `--what`.** That is stricter than the ticket's Goal wording. The worker's final message gives the reason: take-main's question carries no flag, and `decision.owner` refuses a recommendation answer anyway. So a merge question the grant answered could never be used. It is the safe choice.
- **An owner's real answer can be refused by mistake.** `decision answer`'s owner's words that start with `by recommendation: …` would then be turned down as a grant's answer. This is unlikely, and the `decision-use` test uses exactly that route to stand in for one.
- **F3 is still open:** `roles/coordinator.md` never names `--recommend`. The grant memory in the handoff stays until it is fixed, as the worker said.
- Commit `9e5b85e8` is titled `test(…)` but also changes source. The final message says so.

## Checks run

- `npm ci`: no errors.
- `npm run check` and `npm test` in one bash call, timeout 1800 s:
  - tsc clean.
  - 1361 tests, 1299 pass, 0 fail, 62 skipped.
  - Nothing in `limits.test.ts` failed.
  - This matches the worker's numbers.
- Mutations, one at a time, each restored with `git checkout`; `git status` is clean afterwards:

| Mutation | Result |
|---|---|
| `"merge"` removed from the refusal list in `silent.ts` | caught: "a grant never answers a merge question…" fails |
| `recommendedBy` refusal deleted from `decision-use.ts` | caught: "take-main, --unreviewed and --budget 0 refuse…" fails |
| `recommendedBy` refusal deleted from `decision-class.ts` | caught: the silent refusal test fails |
| EEXIST `return` deleted in `decision-hooks.ts` | caught: "…continues the job by itself, once…" fails |
| marker written with `"w"` instead of `"wx"` | caught: same test fails |
| resolve path `failed === undefined \|\| told(failed)` replaced by `true` | caught: "a continue by policy whose wrapper does not start…" fails |

PASS