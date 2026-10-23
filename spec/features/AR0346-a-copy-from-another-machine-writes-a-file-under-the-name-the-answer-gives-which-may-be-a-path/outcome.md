# AR0346 - Outcome

- Merged: 2026-10-23, `3864b01`
- Branch: h/2026-10-23-ar0346-copy-names-b6580c1f
- Reviews: review-1.md PASS
- Cost: worker $1.14, reviews $0.50; review rounds 1

## What went in

- `packages/core/src/machine-sync.ts`: before writing anything from another machine's `records` answer, every record file name is checked against `^[a-z][a-z0-9-]*$`; a path, `..`, a leading dot or `.lock` refuses the whole answer, naming the job and the key. Core's budget 5817.
- `packages/core/docs/commands/spawn.md`: says so.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1055/1055 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/39983880843

## Left open

- Findings: none; no findings.md on this ticket.
