# AR0578 - Outcome

- Merged: 2026-10-30, `a18ef20c`
- Branch: arthur/2026-10-30-worker-f9e3eee7
- Reviews: review-1.md PASS
- Cost: worker $6.14, reviews $1.32; review rounds 1

## What went in

- `packages/core/src/until.ts` (new), `packages/core/src/testing.ts`: the test kit exports one `until(what, predicate, { deadlineMs })`, polling every 20 ms, 20 s by default, that throws `waited <s> s for <what>` past its deadline.
- `test/structure.ts`: test files in every package's `test/` and in the root `test/` are checked; a file that declares its own `until`, a loop that sleeps, or more fixed waits than its baseline is refused.
- `test/structure.test.ts`: the rules' tests, the `FIXED_WAITS` baselines of eleven files, and the core/testing line budget 357 to 369 (+12, AR-D355).
- 37 test files across the packages: their own `until` copies and 20 other sleeping loops replaced by the kit's `until`, keeping the shorter deadlines that mattered.
- `packages/core/test/limits.test.ts`: only `ended` and `before` wait up to 60 s; every other wait uses the 20 s default.
- `docs/plugin-api.md`, `arthur.config.example.ts`: `until` documented; `perJob: { cpu: 3 }` shown with the suite times (711 s on 3 cores).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1298/1366 passed.

## Left open

- Deferred (client summary): F1. The structure check reads a quote or backtick inside a regex literal as the start of a string
- Deferred (client summary): F2. The fixed-wait baseline only refuses growth, so a file can climb back to its old count
- Deferred (client summary): F3. The structure check misses a wait under another name.
- Deferred (client summary): F4. The kit's until default deadline of 20 s is untested.
