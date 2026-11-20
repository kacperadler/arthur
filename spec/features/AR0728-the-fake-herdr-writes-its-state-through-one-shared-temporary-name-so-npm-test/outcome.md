# AR0728 - Outcome

- Merged: 2026-11-20, `3e3b4c4e`
- Branch: arthur/2026-11-20-worker-29ace10e
- Reviews: none
- Cost: worker $2.48, reviews $0.00; review rounds 0

## What went in

- packages/herdr/test/fake-herdr.ts: `save` writes the state to `.state.json.<pid>.<counter>`, a temporary name only its own writer uses, then renames it to `state.json`.
- packages/herdr/test/herdr.test.ts: the first test waits until the second start pass's last call has ended (no child process left) before `seed`; a new test runs 40 fake `herdr` processes and 40 seeds at once against one folder and asserts whole answers, a whole state and no temporary file left.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1845/1916 passed.

## Left open

- Findings: none; no findings.md on this ticket.
