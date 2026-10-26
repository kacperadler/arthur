# AR0457 - Outcome

- Merged: 2026-10-26, `23e91a87`
- Branch: arthur/2026-10-26-worker-c3335bc0
- Reviews: review-1.md PASS
- Cost: worker $3.35, reviews n/a; review rounds 1

## What went in

- `packages/core/src/job-sandbox.ts`: `stepSandbox(folder, { envFile, home, config }, note)` writes in main's checkout only what `checkout()` allows: every top-level entry but `.git`, Arthur's home, `arthur.config.ts` and the env file (and, for one deeper, the other entries on the way), and in `.git` only `objects`, `refs`, `logs` and `index`; symlinks are skipped. A step can no longer write `.git/hooks`, `.git/config` or `.git/info`, nor make a new top-level entry.
- `packages/core/src/plugin-host.ts`, `host.ts`, `testing.ts`, `plugin.ts`: the host passes the env file, home and config paths.
- Tests: `sandbox.test.ts` (a step cannot plant a hook or `core.fsmonitor`, nor write `.git/info`, the home, config or env file, nor a new top-level entry; ordinary writes work), `merge-checks.test.ts`.
- Docs: `merge.md` (what a step may write, the top-level limit), `docs/deploy.md`, `docs/plugin-api.md`. Core line budget 6321 (AR-D94 by policy).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1112/1178 passed.

## Left open

- Tickets from findings: AR0462 (F1: no new top-level entry in a step), AR0463 (F2: a nested repository with its own fsmonitor). F3, F4 dropped.
