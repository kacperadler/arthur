# AR0124 - Outcome

- Merged: 2026-10-18, `05828fd`
- Branch: h/2026-10-18-ar0124-machines-list-56a82238
- Reviews: review-1.md PASS
- Cost: worker $7.97, reviews $1.37; review rounds 1

## What went in

- `packages/machines/`: the new plugin: `list`, `local`, `check.everySeconds`; each machine registered with the job runner, refused at load when its address is public; `ssh <host> arthur version` and os/arch checked at start and every round, `machine-online`/`machine-offline` once per change; a version mismatch counts as offline; one `arthur doctor` line per machine.
- `packages/core/`: `host.jobs.run` takes a time limit; job records name their machine.
- `test/structure.test.ts`: `machines: 280`. README feature table and `arthur.mmd`: entry 30 built.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 405/405 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: none (F1 dropped: AR0128 decides the install command); F2, F3 dropped.
