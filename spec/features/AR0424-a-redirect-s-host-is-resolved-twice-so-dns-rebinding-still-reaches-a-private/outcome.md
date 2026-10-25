# AR0424 - Outcome

- Merged: 2026-10-25, `5debe03c`
- Branch: arthur/2026-10-25-worker-0eed295e
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS, review-4.md PASS
- Cost: worker $4.94, reviews n/a; review rounds 4

## What went in

- `packages/uptime/src/site-check.ts`: a redirect to a host other than the config URL's goes through `node:http`/`node:https` with `agent: false` and a `lookup` that refuses a private address, the one resolution the socket uses, so a name answering a public address first and loopback second never reaches loopback; a hop to a Fetch bad port is refused before any connection; a hop's answer, status and time limit keep their reasons.
- `packages/uptime/src/uptime-options.ts`: `BLOCKED_PORTS` exported.
- `packages/uptime/docs/uptime.md`: says the connection resolves the name again and is refused the same way.
- `packages/uptime/test/uptime.test.ts`: a rebinding name refused with all addresses and with one; a hop's 500, 204, 205, 304, text, time limit and bad port.
- `test/structure.test.ts`: uptime's budget 298 (AR-D29).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1124/1124 passed.

## Left open

- Tickets from findings: AR0435 (F3) dropped, as AR0367's F4 was: NAT64 and 6to4 reach loopback only through a gateway this machine's network does not have; F4 dropped.
