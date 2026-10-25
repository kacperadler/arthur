# AR0341 - Outcome

- Merged: 2026-10-25, `6d780f86`
- Branch: arthur/2026-10-25-worker-da17ff9b
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $3.96, reviews n/a; review rounds 3

## What went in

- `packages/orchestration/src/blocked-notice.ts`: a blocked job's question is redacted with every rule and the env file's values (`host.secrets`) before the phone notice.
- `packages/orchestration/src/inbox.ts`: the wake redacts the question and the final message's `Blocked: user` line with every rule; the final message's other lines lose only the env file's values, so job ids, ticket folders and hashes stay readable.
- `packages/orchestration/src/credential.ts`: `redactValues`, the exact-values half of `redact`.
- `packages/orchestration/docs/commands/coordinator.md`: says so.
- `packages/orchestration/test/job-states.test.ts`: a job blocked with `sk-live-…` and an env-file value gives a `[redacted]` notice and wake; a final-message line keeps a job id, a folder and a hash while its env value is redacted.
- `test/structure.test.ts`: orchestration's budget 2337 (AR-D29).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1121/1121 passed.

## Left open

- Tickets from findings: AR0433 (F2, F3; approved under AR-D31, group 2); F4 dropped.
