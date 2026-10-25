# AR0340 - Outcome

- Merged: 2026-10-25, `69b7aeca`
- Branch: arthur/2026-10-25-worker-f639b3da
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $5.16, reviews n/a; review rounds 2

## What went in

- `packages/core/src/host.ts`, `plugin-host.ts`, `plugin.ts`, `testing.ts`, `docs/plugin-api.md`: the host hands every plugin `host.secrets`, the values of every loaded variable, the env file's included (values only, no names).
- `packages/session/src/credential.ts`, `packages/orchestration/src/credential.ts`: `redact` takes the values to replace, keeps values of 8 characters or more, and replaces the longest first.
- `packages/session/src/start-notice.ts`, `turn-extension.ts`, `packages/orchestration/src/decision-log.ts`, `decision-hooks.ts`, `decision-class.ts`, `inbox.ts`, `inbox-extension.ts`: each redacts with `host.secrets`.
- Tests: a value only in the env file is `[redacted]` in the start notice, the decision log and the inbox; an 8-character value is redacted and a 7-character one kept; a value that starts another is redacted whole.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1118/1118 passed.

## Left open

- Tickets from findings: AR0341 (F1; AR0427 dropped as its duplicate), AR0428 (F2, F5); F3, F4, F6, F7 dropped.
