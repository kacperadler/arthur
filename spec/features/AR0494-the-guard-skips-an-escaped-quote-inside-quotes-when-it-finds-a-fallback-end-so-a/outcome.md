# AR0494 - Outcome

- Merged: 2026-10-28, `9b488940`
- Branch: arthur/2026-10-28-worker-444ea31a
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $1.89, reviews $1.63; review rounds 3

## What went in

- fix(AR0494): a ${…} ends past an escaped quote in quotes, as in bash
- docs(AR0494): F1, limits tests time out under load
- test(AR0494): rows for backslash-newline and an unclosed quote in ${…}
- test(AR0494): row for an unclosed single quote in ${…}

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1163/1230 passed.

## Left open

- Deferred (client summary): F1. limits.test.ts waits time out when the machine runs other suites
