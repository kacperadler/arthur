# AR0313 - Outcome

- Merged: 2026-10-23, `9abe66f`
- Branch: h/2026-10-23-ar0313-301b4366
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.10, reviews $0.89; review rounds 2

## What went in

- `packages/develop/src/eval-scenario.ts`, `eval-run.ts`: an `expect.calls` entry may be `{ match, times }`; a run fails unless exactly `times` calls in the whole turn match it, and a malformed entry stops the scenario with its reason.
- `packages/delivery/evals/check-failed/scenario.json`: the continue naming the failed test is required once, and any other continue is in `never`; `eval.md` documents the format; develop's budget 703.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1050/1050 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/39955786384

## Left open

- Tickets from findings: AR0317 (F1).
