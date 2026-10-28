# AR0532 - Outcome

- Merged: 2026-10-28, `e79b9701`
- Branch: arthur/2026-10-27-worker-96067971
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $6.87, reviews $1.95; review rounds 3

## What went in

- Every message the inbox hands to the coordinator (a job's end, a review, a channel message, a quoted line) gets a word joiner before each at-sign omp would read as a file to attach, so no text a job or an outsider writes makes the coordinator read a file into its context.
- The test checks the handed-over text against omp's own pattern, for an at-sign at the start of a line, after any whitespace (the uncommon spaces included), and after each bracket and quote omp accepts.
- `docs/commands/coordinator.md` says how the escape works; F1 records how omp 18.3.0 reads such files.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1159/1226 passed.

## Left open

- Tickets from findings: AR0537 (F2), AR0538 (F3), AR0539 (F4).
