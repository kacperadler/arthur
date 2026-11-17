# AR0702 - Outcome

- Merged: 2026-11-17, `9d05e078`
- Branch: arthur/2026-11-17-worker-5c92907a
- Reviews: review-1.md PASS
- Cost: worker $6.03, reviews $0.86; review rounds 1

## What went in

- fix(AR0702): remove a tagged image by each tag and count it once
- test(AR0702): sweep notice only once an image's last tag went
- fix(AR0702): count each removed object once in the sweep's notice
- test(AR0702): one byte of cache given back sends the notice
- test(AR0702): raise the docker line budget to 720
- test(AR0702): a removal cut half-way names the image tags left

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1826/1897 passed.

## Left open

- Deferred (client summary): F1. No test holds the exit 1 of `arthur docker sweep` stopped half-way
