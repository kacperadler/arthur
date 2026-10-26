# AR0458 - Outcome

- Merged: 2026-10-26, `17100e1b`
- Branch: arthur/2026-10-26-worker-5e33d5b1
- Reviews: review-1.md PASS
- Cost: worker $0.58, reviews n/a; review rounds 1

## What went in

- `packages/core/src/wrapper.ts`: the hidden list (`hidden(folder)`) is read once, before the install, and the same list hides the env file from the install and from every agent run; what the install writes to the record cannot change it.
- `packages/core/test/sandbox.test.ts`: an install that empties the record's guarded list, then an agent reading the env file, gets `EACCES`, and no record file holds the secret.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1113/1179 passed.

## Left open

- None: the review's notes F1, F2 dropped (findings.md).
