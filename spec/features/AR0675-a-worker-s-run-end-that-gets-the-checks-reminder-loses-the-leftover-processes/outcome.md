# AR0675 - Outcome

- Merged: 2026-11-18, `01e81fee`
- Branch: arthur/2026-11-18-worker-193ee6d4
- Reviews: review-1.md PASS
- Cost: worker $5.82, reviews $0.54; review rounds 1

## What went in

- packages/delivery/src/checks-extension.ts: holds delivery's one `session_stop` handler, which joins the checks reminder (workers only) and the processes reminder, checks first, each given at most once per run.
- packages/delivery/src/processes-extension.ts: exports `leftProcesses(id)`, the processes reminder text or undefined; its default export registers nothing and stays for job records written before AR0675.
- packages/delivery/src/delivery.ts: registers `checks-extension.ts` as delivery's only OMP extension.
- packages/delivery/docs/delivery.md: "Processes a job leaves running" describes the one joined answer, the once-each rule and the older-record case.
- packages/delivery/test/checks.test.ts: tests the once-each rule in both orders, the joined text, and that a spawned job's record names `checks-extension.ts` alone.
- packages/delivery/test/processes.test.ts: loads `checks-extension.ts` in the fake agent; adds the worker-gets-both test, the older-record test, and a test of every `@` guard position.
- spec/features/AR0675-a-worker-s-run-end-that-gets-the-checks-reminder-loses-the-leftover-processes/findings.md: new, with F1 (open) on the kept default export.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1836/1907 passed.

## Left open

- Deferred (client summary): F1. processes-extension.ts keeps an empty default export for job records written before AR0675
