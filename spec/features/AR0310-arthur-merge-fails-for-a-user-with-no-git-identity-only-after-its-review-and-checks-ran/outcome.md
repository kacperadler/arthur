# AR0310 - Outcome

- Merged: 2026-10-23, `5aae50d`
- Branch: h/2026-10-23-ar0310-git-identity-chec-78843a24
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.09, reviews $1.17; review rounds 2

## What went in

- `packages/delivery/src/merge-command.ts`: `arthur merge` checks git's author and committer identity first and refuses with the fix named, before CI waits, checks or the merge; Arthur never sets one itself.
- `packages/delivery/src/delivery.ts`: `arthur doctor` (and `arthur setup`, `arthur run`'s start) prints one `delivery <project> identity` line per project, missing with its fix when git has none.
- `merge.md`, `doctor.md`: the refusal, what the coordinator does with it, and the doctor line; delivery's budget 1305.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1049/1049 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/39950766003

## Left open

- Tickets from findings: AR0316 (F1).
