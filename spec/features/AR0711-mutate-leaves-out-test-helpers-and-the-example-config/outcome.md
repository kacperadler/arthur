# AR0711 - Outcome

- Merged: 2026-11-14, `392de77e`
- Branch: arthur/2026-11-13-worker-d804912a
- Reviews: review-1.md PASS
- Cost: worker $1.54, reviews $0.34; review rounds 1

## What went in

- test/mutate.ts: mutates only the branch's own code. It leaves out `*.test.ts`, `*.d.ts`, every file under `packages/<p>/test/` and `arthur.config.example.ts`, and a comment says why.
- test/mutate.test.ts: tests that a branch changing a source file, a package test helper, the example config, a root test and a declaration has only the source file mutated.
- packages/activity/test/log-command.test.ts: the read-back test asks for the day its events were filed under, so it passes on any date.
- spec/features/AR0711-mutate-leaves-out-test-helpers-and-the-example-config/findings.md: F1, the date-bound activity log test, fixed in d9c8a727.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1759/1830 passed.

## Left open

- Tickets from findings: none open.
