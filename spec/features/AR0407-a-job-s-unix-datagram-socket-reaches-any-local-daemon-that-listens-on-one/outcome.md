# AR0407 - Outcome

- Merged: 2026-10-25, `1256ab3a`
- Branch: arthur/2026-10-25-worker-c9f2c4e7
- Reviews: none
- Cost: worker $0.50, reviews $0.00; review rounds 0

## What went in

- `packages/core/docs/commands/spawn.md`, "The sandbox" (`arthur spawn --help`): a new limit says the Unix datagram socket omp's lock needs lets a job write lines into journald's sockets, each stamped with its `arthur-job-<id>.scope`, and reach nothing else (systemd's notify sockets refuse a scope; the only abstract names are omp's locks).
- `docs/deploy.md`, the sandbox entry: one sentence saying the same.
- No review: docs only (`arthur review-needed`); merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1105/1105 passed.

## Left open

- Findings: none; no findings.md on this ticket.
