# AR0688 - Review 1

- Job: 2026-11-11-review-898480b5
- Branch: arthur/2026-11-10-worker-f8fed7e4
- Commit reviewed: 0930df850d024664b1435a9053923102bc34b327
- Verdict: FAIL

## Final message

I'm failing this branch on one point. The F3 notice is meant to give the text of the option the owner picked, but no test checks that past option 1. The F1 spawn check is correct and covered.

## Findings

1. **`packages/orchestration/src/decision-writes.ts:66`: no test checks which option's text the notice gives.** The ticket asks that the notice give the picked option's text and that a test prove it. Every test that checks the notice text either picks option 1 or picks nothing. I changed `found.options[picked - 1]` to `found.options[0]` and ran `packages/orchestration/test/decisions.test.ts`: 43 passed, 0 failed. With that change, an answer recorded as `--picked 2` on a merge or plan question would show `picked: option 2, "<option 1's words>"`. That is the misleading "what was recorded" notice F3 is meant to prevent. `npm run mutate` did not generate this mutant, so its 20/20 result does not cover it. The fix is to add a high-impact `--picked 2` row to `decisions.test.ts` (for example the `"Not yet"/"Merge it"` ask answered with `--picked 2`) that expects `picked: option 2, "Merge it"`.

## Notes
- (minor) `packages/orchestration/test/silent.test.ts:118`: the sample notice there still uses the old format, with no `picked:` part. It only feeds the `silent` filter, so nothing breaks; the file is outside the range.

## Checks (on `0930df85`)
- **Spawn check (F1):** `plans.ts:85` requires `answers.at(-1)?.picked === 1` before the decided-line and commit check. A later `--picked 2` answer refuses the worker again, and a later `--picked 1` lets it start; `plans.test.ts` tests both.
- **Stale wording:** searched for the notice format and the refusal text. `docs/commands/plan.md` and `docs/commands/decision.md` are updated, and no other doc or role repeats the old text.
- **`npm run check && npm test`:** tsc clean. The first run's filter dropped the counts, so I ran `npm test` again: tests 1696, pass 1632, fail 0, cancelled 0, skipped 64. The structure test passed and listed no changed file as yellow.
- **`npm run mutate`:** 20 mutants, 20 caught, 0 survived.
- **Hand mutation, `plans.ts:85`:** `picked === 1` → `picked !== undefined`. `plans.test.ts` fails 1 of 18, in the AR0665/AR0688 approval test. Restored with `git checkout`.
- **Hand mutation, `decision-writes.ts:66`:** `options[picked - 1]` → `options[0]`. `decisions.test.ts` passed 43 of 43, so the mutant survived. Restored with `git checkout`; `git status` is clean.

FAIL