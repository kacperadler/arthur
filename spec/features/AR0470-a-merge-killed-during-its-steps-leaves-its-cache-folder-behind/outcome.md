# AR0470 - Outcome

- Merged: 2026-10-28, `4a964c77`
- Branch: arthur/2026-10-27-worker-7ccfb33a
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $4.03, reviews $1.73; review rounds 3

## What went in

- Each merge now first removes the cache folders older than a day that a killed merge left in delivery's folder, only at the top level, so a running merge's cache is never touched.
- A merge's cache folders are named `cache_<random>`: no project name or job id holds `_`, so the sweep never reaches a project's folder and its `last-merge` record.
- Folders named `cache-<random>` that merges killed before this change left are not swept (F2, AR0536).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1158/1225 passed.

## Left open

- Tickets from findings: AR0535 (F1), AR0536 (F2).
