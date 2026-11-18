# AR0724 - Outcome

- Merged: 2026-11-18, `753f98ed`
- Branch: arthur/2026-11-18-worker-37bcba2e
- Reviews: review-1.md PASS
- Cost: worker $5.33, reviews $0.48; review rounds 1

## What went in

- packages/docker/test/fake-docker.ts: imports no `@arthur/core`; reads `--max-used-space` itself (a number, then K, M, G or T, powers of 1024, or none, 1 byte or more) and refuses any other form with exit 2. A start costs 0.185 to 0.115 CPU-s without the compile cache, 0.049 to 0.032 with it. `sweep.test.ts` alone, before on a41adb4a and after: 83.0 to 63.8 CPU-s without the cache (a fall of 19.2, accepted for the ticket's 60 by AR-D699), 24.7 to 21.4 with it; `cleanup.test.ts`: 64.9 to 48.8 and 20.0 to 16.3.
- packages/docker/test/fake-shapes.test.ts: two new tests: `builder prune --max-used-space` cuts the cache to each size form and refuses 18 others with the cache whole; a start of the fake docker loads no file but its own.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1841/1912 passed.

## Left open

- Findings: none; no findings.md on this ticket.
