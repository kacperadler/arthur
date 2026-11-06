# AR0638 - host.secrets holds only enabled plugins values, so the public decision log misses other env file values

```json
{
  "id": "AR0638",
  "title": "host.secrets holds only enabled plugins values, so the public decision log misses other env file values",
  "date": "2026-11-06"
}
```

## Description

The nightly audit of 2026-11-06 (proposal 4), taking F1 of AR0525: `host.secrets` holds only enabled plugins' values, while `hide` names every env file value, so the public decision log is the one written text that can carry an env file value raw.

## Goal

Every text a plugin redacts with `host.secrets`, the public decision log first, has every env file value replaced, not only the enabled plugins'.

Evidence:
- `packages/core/src/host.ts:50`: `secrets` comes from `resolveEnv`'s values, the enabled plugins' only; on the same line `hide` names every value of the env file.
- `packages/core/test/host.test.ts:61` pins it ("never … a disabled plugin's"); the test at `:80` checks that `hide` names a disabled plugin's value and a loose one.
- `packages/orchestration/src/decision-writes.ts:26,45` redact the decision log only with `host.secrets` plus shape rules; `spec/decisions.jsonl` is tracked and pushed with the board.
- `packages/core/docs/commands/config.md:26` says every env file value is named everywhere Arthur writes, "a disabled plugin's and one no plugin reads included".
- The shape rules catch only values of 20 or more characters that mix letters and digits, so a shorter or single-class value of a disabled plugin would reach the log.

- Kind: security

## Done means

- `host.secrets` is built from every env file value (as `hide` is) plus the enabled plugins' shell values.
- `host.test.ts:61` is changed to the new contract, and a test fails when a disabled plugin's or a loose env file value is left out of `host.secrets`; a decision answer that quotes such a value is written to the log redacted.
- `docs/plugin-api.md` (the AR0340 line) and `packages/orchestration/docs/commands/decision.md:22` describe the new set.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/host.ts`, `packages/core/test/host.test.ts`, `docs/plugin-api.md`, `packages/orchestration/docs/commands/decision.md`, an orchestration test of the decision log.

Out:
- The shape rules and `hide` itself.

## Decisions
- 2026-11-06: Source: audit spec/quality/2026-11-06.md
- 2026-11-06: Source: F1 of AR0525
