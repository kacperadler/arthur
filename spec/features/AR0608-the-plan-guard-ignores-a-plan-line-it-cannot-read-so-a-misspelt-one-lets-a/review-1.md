# AR0608 - Review 1

- Job: 2026-11-04-review-1d2515b1
- Branch: arthur/2026-11-04-worker-3c83b683
- Commit reviewed: f163624e9afe09608ed8e214267edf2b722e5aa6
- Verdict: FAIL

## Final message

The branch meets the ticket's Done means points, but one mutation in the guard survives, so this is a FAIL.

## Findings

1. `packages/orchestration/src/plans.ts:17`: **the `+` bullet is never tested.** `npm run mutate` reports this mutant as survived:
   `const MARK = /^\s*[-*+]\s*plan\s*:/i;` => `const MARK = /^\s*[-*]\s*plan\s*:/i;`
   - **Why it matters:** the worker's message says the guard covers any bullet (`-`, `*`, `+`), and the doc page `packages/orchestration/docs/commands/plan.md:32` says the same. Nothing tests the `+` case.
   - **The risk:** if someone drops `+` from the pattern, the tests still pass. A ticket with `+ Plan: tak` under its Goal would then be read as having no plan, and a worker would start without one. That is exactly what AR0608 exists to stop.
   - **Fix:** add `"+ Plan: yes"` to the refused forms in the loop at `packages/orchestration/test/plans.test.ts:196`.

Everything else holds:
- `- Plan: tak`, `- Plan: Yes`, `- Plan: no` and an empty `- Plan:` each get their own refusal assertion. The message names the ticket, the line and the one accepted form.
- A ticket with no Plan line (`- Planning: later`) still starts a worker.
- The other 15 mutants were caught.
- The doc page lists the new refusal.
- `plans.ts` is 110 lines, so green; the structure test passes.
- The worker's claims about checks and files match what I saw.

## Notes
- (risk) `packages/orchestration/src/plans.ts:17`: some Goal lines still get past the guard and count as no plan: a numbered item (`1. Plan: tak`), bold text (`- **Plan**: tak`), an en-dash bullet (`– Plan: tak`), a separator other than a colon (`- Plan - yes`, `- Plan tak`), and a line with no bullet (`Plan: tak`). The ticket only names the `- Plan:` form, so none of these blocks the merge.
- (minor) `packages/orchestration/src/plans.ts:70`: the `marks` parameter is `string[]`; the styleguide asks for `readonly string[]` on inputs, as `decisions` already has.
- (risk) Outside this branch: one of my two `npm test` runs left a fake agent running (`packages/core/src/fake-agent.ts` with `-e packages/session/src/handoff-extension.ts`, pid 1656976, about 9 minutes old). Some test does not stop it. I stopped it with `kill`.

## Checks (on f163624e, clean checkout)
- `npm run check`: tsc finished with no errors.
- `npm test`: 1549 tests, 1485 pass, 0 fail, 64 skipped. No yellow line for `plans.ts`.
- `npm run mutate`: 16 mutants, 15 caught, 1 survived (the `+` bullet one above). `git status` was clean afterwards.

FAIL