# AR0367 - Outcome

- Merged: 2026-10-25, `d89d43bc`
- Branch: arthur/2026-10-25-worker-f58f2f36
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.78, reviews n/a; review rounds 2

## What went in

- `packages/uptime/src/site-check.ts`: a check follows redirects itself (`redirect: "manual"`, at most 20 hops of 301, 302, 303, 307, 308 with a `Location`); a hop to another host than the config URL's is refused when any address it resolves to is loopback, link-local or private (`redirected to <host>, a private address the config does not name`, an answer, so the site counts down, not this machine offline).
- `packages/uptime/src/uptime.ts`: lines folded to pay for it; no behaviour change.
- `packages/uptime/docs/uptime.md`, `packages/uptime/src/uptime-options.ts`: say the ranges, the 21st-redirect rule and the new reason.
- `packages/uptime/test/uptime.test.ts`: each refused range, a mixed public/private name, a 3xx without `Location`, a same-host redirect followed, 20 and 21 hops.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1112/1112 passed.

## Left open

- Tickets from findings: AR0424 (F1), AR0425 (F2, F3); F4-F6 dropped.
