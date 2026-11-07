# AR0638 - Outcome

- Merged: 2026-11-07, `39996965`
- Branch: arthur/2026-11-07-worker-910b964f
- Reviews: review-1.md PASS
- Cost: worker $2.05, reviews $0.56; review rounds 1

## What went in

- `packages/core/src/host.ts`: `secrets` is `hide`'s values with duplicates removed: every env file value (none inside a job) and every enabled plugin's shell value, 8 characters or more.
- `packages/core/src/plugin.ts`: the `Host.secrets` comment describes the new set.
- `packages/core/test/host.test.ts`: the `host.secrets` test pins a disabled plugin's value, a loose value and a shell-overridden env file value, plus the shell-only set inside a job.
- `packages/orchestration/test/decisions.test.ts`: a CLI test where an answer quoting a disabled plugin's value and a loose env file value is written to `spec/decisions.jsonl` redacted.
- `docs/plugin-api.md`: the `secrets` row and the AR0340 line describe the new set and the AR0638 change.
- `packages/orchestration/docs/commands/decision.md`: the redaction paragraph names every env file value plus enabled plugins' shell values.
- `packages/orchestration/docs/commands/coordinator.md`: the wake and the no-reply notice describe `host.secrets` as the new set.
- `packages/session/docs/session.md`: the notice redaction describes `host.secrets` as the new set.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1543/1614 passed.

## Left open

- Findings: none; no findings.md on this ticket.
