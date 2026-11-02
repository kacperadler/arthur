# AR0579 - Outcome

- Merged: 2026-10-31, `6d1e9372`
- Branch: arthur/2026-10-31-worker-b935bce1
- Reviews: review-1.md PASS
- Cost: worker $5.29, reviews $0.34; review rounds 1

## What went in

- test/mutate.ts: new `npm run mutate [-- --max <n>]`: mutates the branch's changed source files, runs the same-name test, then importers, then the package's `test/`, names survivors, restores files on exit and on signal, refuses a dirty tree, caps at 25 by default.
- test/mutate.test.ts: new tests: a survivor named and a caught one not, with the test order and package scope; `--max` and the usage; a restore and the test processes stopped after SIGTERM; a dirty tree refused.
- package.json: adds the `mutate` script.
- packages/delivery/src/checks-extension.ts: records `mutate pass|fail` per `npm run mutate`, gives it the 1800 s timeout, and judges its clean tree by commit and status only.
- packages/delivery/test/checks.test.ts: tests for the mutate line's pass/fail, timeout, missing script, and clean/dirty cases.
- packages/delivery/docs/commands/review-needed.md: "The job's checks" describes the mutate line, its timeout and its clean rule.
- packages/core/roles/worker.md: the two mutation lines become one, naming `npm run mutate`.
- packages/delivery/roles/reviewer.md: the mutation line starts from mutate's survivors.
- test/structure.test.ts: delivery budget 1895 → 1897.
- README.md: the development line names `npm run mutate` and its cap.
- spec/features/AR0579-defaults-t11-npm-run-mutate-finds-the-tests-that-do-not-catch-a-change/findings.md: new, F1 on the mutate line's clean tree.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1341/1410 passed.

## Left open

- Deferred (client summary): F1. A mutate line stays clean when another command of its call changes a file and puts it back
- Deferred (client summary): F2. with the default `--max 25`, it runs only the first mutants in file order, and "hunk reverted" mutants come first
- Deferred (client summary): F3. a `mutate` line is judged `clean` by commit and status only
