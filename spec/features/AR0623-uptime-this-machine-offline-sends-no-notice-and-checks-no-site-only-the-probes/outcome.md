# AR0623 - Outcome

- Merged: 2026-11-04, `8e7ed5c6`
- Branch: arthur/2026-11-04-worker-a260185c
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $3.60, reviews $0.69; review rounds 2

## What went in

- fix(AR0623): uptime offline sends no notice and asks only the probes
- test(AR0623): a site failing after offline needs 2 new failed checks
- refactor(AR0623): fold the offline comment to stay in the uptime budget
- docs(AR0623): record a discord menu test that failed once under load
- fix(AR0623): with probes: [] a stored offline is ignored and cleared
- docs(AR0623): a stored offline is ignored with probes: []

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1472/1543 passed.

## Left open

- Deferred (client summary): F1. A discord menu test failed once under the full suite and passes alone
