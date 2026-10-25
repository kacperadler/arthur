# AR0406 - Outcome

- Merged: 2026-10-25, `a65274c5`
- Branch: arthur/2026-10-25-worker-85b11402
- Reviews: none; merged unreviewed (--unreviewed): no PASS on arthur/2026-10-25-worker-85b11402's tip 3b44c89: no review of it has a verdict (last PASS: none)
- Cost: worker $2.96, reviews $0.00; review rounds 0

## What went in

- `packages/core/src/job-sandbox.ts`: the seccomp filter lets a job's agent make a Unix datagram socket, which omp's session lock binds to an abstract name, so a sandboxed job keeps its session and ends `finished` (a review's PASS gets its verdict); Unix stream, seqpacket and other types and io_uring stay refused, and the log line says `opens no Unix socket but a datagram one`.
- `packages/core/test/sandbox.test.ts`: a test that takes omp's lock inside the sandbox while stream and seqpacket sockets are refused, and one that runs a job whose fake agent takes the lock and ends a review `finished` with PASS; these and two older socket tests skip where the test process itself cannot make a Unix socket (inside a job).
- `packages/core/docs/commands/spawn.md` and `docs/deploy.md`: the sandbox allows Unix datagram sockets.
- Reviewed by 2026-10-25-review-6e19990f, whose report ended PASS but which exited 1 under the old sandbox, so it had no verdict; merged `--unreviewed` on that report by the owner's AR-D4.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1106/1106 passed.

## Left open

- Tickets from findings: AR0407 (F1, F4).
