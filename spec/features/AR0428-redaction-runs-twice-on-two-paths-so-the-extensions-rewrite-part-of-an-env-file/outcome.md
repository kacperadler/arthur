# AR0428 - Outcome

- Merged: 2026-10-25, `ae778efe`
- Branch: arthur/2026-10-25-worker-de062520
- Reviews: review-1.md PASS
- Cost: worker $1.55, reviews n/a; review rounds 1

## What went in

- `packages/orchestration/src/inbox-extension.ts`, `packages/session/src/turn-extension.ts`: no longer redact; they write omp's error raw into the 0700 home.
- `packages/orchestration/src/inbox.ts` (`sweep`), `packages/session/src/start-notice.ts` (`line()`): redact once with `host.secrets` before the phone, so an env-file secret is replaced whole (`pass-word-sk-live-…` gives `[redacted]`, not `pass-word-[redacted]`).
- Docs of both plugins: the raw copies (`turn-failed/` deleted at the next sweep, `outbox/sent/` kept 7 days) and why.
- Tests: a socket-free test drives the real extension through a fake `pi` and the sweep; the tmux test checks no part of an env-file value reaches the notice.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1121/1121 passed.

## Left open

- Tickets from findings: AR0434 (F1; approved under AR-D31, group 2).
