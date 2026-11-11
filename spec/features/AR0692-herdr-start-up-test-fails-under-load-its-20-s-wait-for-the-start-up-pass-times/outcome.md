# AR0692 - Outcome

- Merged: 2026-11-11, `eca9687c`
- Branch: arthur/2026-11-11-worker-653f9e16
- Reviews: none
- Cost: worker $1.60, reviews $0.00; review rounds 0

## What went in

- packages/herdr/test/fake-herdr.ts: the fake `herdr` no longer loads `@arthur/core/testing`: its folder is made in the kit's TMPDIR with `mkdtempSync`, and its `/bin/sh` script runs node with `NODE_COMPILE_CACHE` in that folder. A call now starts almost as fast as a bare node, so the herdr tests' start-up pass finishes within `until`'s 20 s under load.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1676/1747 passed.

## Left open

- Findings: none; no findings.md on this ticket.
