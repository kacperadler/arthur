# AR0587 - Outcome

- Merged: 2026-10-30, `0c4b7f93`
- Branch: arthur/2026-10-30-worker-281fa71b
- Reviews: review-1.md PASS
- Cost: worker $0.49, reviews $0.28; review rounds 1

## What went in

- `test/report-check.test.ts`: the browser is looked for under the real user's home (`userInfo().homedir`, from the user database, not `HOME`), in the same cache folders as the check, newest first, and handed to the check as `CHROME`; the 14 report-check tests run on this server again (13 skipped before).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1273/1341 passed.

## Left open

- Deferred (client summary): F1. test/report-check.test.ts is 225 lines.
- Deferred (client summary): F2. With no browser found, CHROME is undefined and spawnSync drops it.
