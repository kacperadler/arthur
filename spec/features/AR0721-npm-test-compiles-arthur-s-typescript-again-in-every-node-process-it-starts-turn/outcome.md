# AR0721 - Outcome

- Merged: 2026-11-18, `47b0de43`
- Branch: arthur/2026-11-18-worker-3afab526
- Reviews: review-1.md PASS
- Cost: worker $3.99, reviews $0.40; review rounds 1

## What went in

- packages/core/src/test-env.ts: sets `NODE_COMPILE_CACHE` to the checkout's `node_modules/.cache/arthur-test-compile` when unset or empty, makes a relative one absolute, and turns Node's compile cache on in that folder.
- packages/core/test/testing.test.ts: a test that a child loading the kit, and a `node -p` child it starts elsewhere, use one cache folder — the checkout's, or the one `NODE_COMPILE_CACHE` names; skipped under `NODE_DISABLE_COMPILE_CACHE`.
- test/structure.test.ts: the `core/testing` line budget is 413, up from 408.
- spec/features/AR0721-npm-test-compiles-arthur-s-typescript-again-in-every-node-process-it-starts-turn/findings.md: F1, the cache folder grows about 7 MB and 1217 files per `npm test` and nothing removes it; open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1837/1908 passed.

## Left open

- Deferred (client summary): F1. The test run's compile cache grows by about 7 MB and 1217 files with every `npm test`, and nothing removes it
