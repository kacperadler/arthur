# AR0515 - Outcome

- Merged: 2026-10-29, `2f79e8ca`
- Branch: arthur/2026-10-29-worker-f9484a41
- Reviews: review-1.md PASS
- Cost: worker $2.35, reviews $0.56; review rounds 1

## What went in

- A job's sandbox, and each merge step's, hides the `.ssh` in the user account's home, where OpenSSH looks, and also `$HOME`'s when `$HOME` points elsewhere, so a changed `HOME` no longer leaves the real key readable; the `guarded` file names the same folders. The core line budget went to 6448 (AR-D295).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1208/1276 passed.

## Left open

- Deferred (client summary): F1. A user id with no account entry now fails every spawn and merge step
