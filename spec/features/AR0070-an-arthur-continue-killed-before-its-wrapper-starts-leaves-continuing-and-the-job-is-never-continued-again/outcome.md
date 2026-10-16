# AR0070 - Outcome

- Merged: 2026-10-16, `8e9fcd3`
- Branch: h/2026-10-16-ar0070-continue-killed-b-771a00d8
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.11, reviews $0.80; review rounds 2

## What went in

- `continueJob` takes the `continuing` lock with `lock.ts` (pid and boot id), so a killed continue's lock is taken over and a live one refused; a folder left by the old code counts as dead; the continue waits until the state is `running` or the wrapper is gone; `continue.md` updated. The narrow gap between the wrapper's `pid` and `state` writes is AR0085.

## Checks on main

- `npm run check`: passed.
- `npm test`: 270/270 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0085 (F1).
