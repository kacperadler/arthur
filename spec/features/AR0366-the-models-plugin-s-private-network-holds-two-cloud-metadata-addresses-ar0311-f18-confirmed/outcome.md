# AR0366 - Outcome

- Merged: 2026-10-25, `8ee419e4`
- Branch: arthur/2026-10-25-worker-7ffd56dc
- Reviews: review-1.md PASS
- Cost: worker $1.15, reviews n/a; review rounds 1

## What went in

- `packages/models/src/model-options.ts`: a `METADATA` list (`100.100.100.200`, `fd00:ec2::254`) checked first by `isPrivate`, so a provider URL, a name resolving there, or a probe's address there counts as not private and is refused.
- `packages/machines/src/machine-check.ts`: `100.100.100.200` counts as public, so a machine with that address is refused at load or goes offline at its check; `fd00:ec2::254` was already outside its private ranges.
- `packages/models/docs/models.md`, `packages/machines/docs/commands/machines.md`: name the exceptions.
- `packages/models/test/models.test.ts`, `packages/machines/test/machines.test.ts`: the metadata addresses (and IPv4-mapped forms) refused, their neighbours accepted, a name resolving to `100.100.100.200` refuses the load.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1107/1107 passed.

## Left open

- Findings: F1-F5, review notes, dropped (see findings.md).
