# AR0444 - Outcome

- Merged: 2026-10-26, `3af222ae`
- Branch: arthur/2026-10-26-worker-9b8cb81a
- Reviews: review-1.md PASS
- Cost: worker $0.79, reviews n/a; review rounds 1

## What went in

- `packages/uptime/test/uptime.test.ts`: the DNS-rebinding redirect test asks its site at `127.0.0.1` instead of `localhost`, so with one address tried (`setDefaultAutoSelectFamily(false)`) a runner whose `localhost` resolves to `::1` first no longer refuses the first request before the redirect; `site-check.ts` unchanged.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1144/1150 passed.

## Left open

- F1: dropped (see findings.md).
