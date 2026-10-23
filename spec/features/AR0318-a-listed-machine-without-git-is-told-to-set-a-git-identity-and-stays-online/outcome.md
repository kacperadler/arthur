# AR0318 - Outcome

- Merged: 2026-10-23, `3ce46a6`
- Branch: h/2026-10-23-ar0318-73f850b5
- Reviews: review-1.md PASS
- Cost: worker $1.31, reviews $0.47; review rounds 1

## What went in

- `packages/machines/src/machine-check.ts`: a listed machine whose `git var` exits 127 is offline with `git is not there (…)` and the fix to install git on the PATH of a command over ssh, so no job is placed there; an exit 128 is still a missing identity. `machines.md`, `docs/deploy.md` document it; machines' budget 487.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1051/1051 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/39963610485

## Left open

- Findings: none; no findings.md on this ticket.
