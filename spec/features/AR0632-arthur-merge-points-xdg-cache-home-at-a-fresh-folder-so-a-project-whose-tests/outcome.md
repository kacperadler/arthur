# AR0632 - Outcome

- Merged: 2026-11-09, `5c1c8212`
- Branch: arthur/2026-11-09-worker-544a2960
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.12, reviews $1.60; review rounds 2

## What went in

- `packages/core/src/job-sandbox.ts`: on Linux, `stepSandbox` gives each step `PLAYWRIGHT_BROWSERS_PATH` pointing at Playwright's default folder in Arthur's environment, unless that environment names its own; the folder is not writable to the step. It sits beside main's `unread()` hidden list.
- `packages/core/test/sandbox.test.ts`: a fake `playwright` and two AR0632 tests: the six cases without the sandbox, and the real-sandbox launch with writes into the browsers folder refused.
- `packages/delivery/docs/commands/merge.md`: "Checks on main" says each step gets `PLAYWRIGHT_BROWSERS_PATH`, where it points, why, and that the step writes nothing there.
- `docs/plugin-api.md`: the `sandbox(folder, cache, note)` row names `PLAYWRIGHT_BROWSERS_PATH`, read-only.
- `test/structure.test.ts`: core line budget 7445, main's 7444 plus the one line this change needs (AR-D538).
- `spec/features/AR0632-arthur-merge-points-xdg-cache-home-at-a-fresh-folder-so-a-project-whose-tests/findings.md`: new; F1, a fake agent a test run leaves running.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1599/1670 passed.

## Left open

- Deferred (client summary): F1. A test run leaves a fake agent with the session plugin's handoff extension running
