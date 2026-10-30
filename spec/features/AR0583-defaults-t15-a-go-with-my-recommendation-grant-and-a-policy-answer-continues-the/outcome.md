# AR0583 - Outcome

- Merged: 2026-10-30, `691ec332`
- Branch: arthur/2026-10-30-worker-6d2278ad
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $15.20, reviews $2.26; review rounds 3

## What went in

- `packages/orchestration/src/silent.ts`: `arthur silent on '<work>' [--until HH:MM] [--usage <pct>] [--tickets <ids>] --recommend` holds a go-with-my-recommendation grant, with at least one bound, all of which must hold; it answers an ask with its recommended option `by recommendation (G<n>)`, never a merge, budget or class ask, nor one with `--what`; `off`, a plain `on` or `/silent on` ends it; a hand-edited grant answers nothing.
- `packages/orchestration/src/decision-log.ts`, `decision-commands.ts`: an ask the grant answers is recorded as answered, and printed so.
- `packages/orchestration/src/decision-hooks.ts`: a job blocked on a question that a policy or the grant answers is continued with that answer, once; a continue that fails or resolves with a reason is told to the coordinator.
- `packages/orchestration/src/decision-use.ts`, `decision-class.ts`: a by-recommendation answer never counts as the owner's word (take-main, `--unreviewed`, `--no-ci`, `--budget 0`) and never backs a class.
- `packages/models/src/models.ts`: `models.usage` gives the weekly usage the `--usage` bound reads.
- `packages/orchestration/docs/commands/silent.md`, `decision.md`, `packages/models/docs/commands/usage.md`: say the above.
- `packages/orchestration/test/silent.test.ts`, `decisions.test.ts`, `decision-use.test.ts`, `inbox.test.ts`, `packages/models/test/models.test.ts`: tests of each bound, refusal and continue.
- `test/structure.test.ts`: orchestration 2463 to 2575 (+112, AR-D378, AR-D381) and models 509 to 516 (+7).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1312/1380 passed.

## Left open

- Deferred (client summary): F3. The coordinator's role does not say when to record a grant
- Deferred (client summary): F4. An owner answer whose words start with by recommendation is refused as a grant's.
- Deferred (client summary): F5. Commit 9e5b85e8 is titled test but changes source.
