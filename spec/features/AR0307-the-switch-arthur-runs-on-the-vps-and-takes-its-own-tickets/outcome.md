# AR0307 - Outcome

- Merged: 2026-10-25, `15faf015`
- Branch: arthur/2026-10-25-worker-5da05172
- Reviews: review-1.md PASS
- Cost: worker $2.38, reviews n/a; review rounds 1

## What went in

- `.agents/harness/` is gone (its criteria copies and `project.json`): Arthur's own roles read only `.agents/arthur/`, and `.agents/arthur/criteria/styleguide.md` and `review.md` no longer say to keep a second copy.
- `test/arthur-criteria.test.ts`: the test comparing the two criteria copies is removed (the owner's decision); the AR0272 and AR0273 tests stay.
- `README.md`: the status says Arthur is in use on its own repository since 2026-10-25, as a systemd service on its owner's VPS with Telegram, each ticket going from worker through review and CI to merge (the owner's decision).
- `docs/setup.md`: the steps match the real run of 2026-10-25 (config, the env file, systemd, the coordinator); `docs/deploy.md` and `arthur.config.example.ts` fixed to match.
- The first ticket taken end to end by Arthur itself: worker, review PASS filed, merge on the owner's AR-D5.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1105/1105 passed.

## Left open

- Tickets from findings: AR0408 (F1), AR0409 (F2), AR0410 (F3), AR0411 (F4).
