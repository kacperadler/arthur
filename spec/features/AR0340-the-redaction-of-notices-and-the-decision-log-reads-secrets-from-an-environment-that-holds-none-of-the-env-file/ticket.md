# AR0340 - The redaction of notices and the decision log reads secrets from an environment that holds none of the env file

```json
{
  "id": "AR0340",
  "title": "The redaction of notices and the decision log reads secrets from an environment that holds none of the env file",
  "date": "2026-10-23"
}
```

## Description

a token in a model's error text, a job's question or the owner's answer reaches a Telegram notice or `spec/decisions.jsonl`, which is committed.

## Goal

The redaction of notices and the decision log knows the values of the .env file, so a secret from it never reaches the phone or the log; tested.

- Kind: bug

Evidence:
- `packages/session/src/credential.ts:9`, `packages/orchestration/src/credential.ts:10` (`Object.entries(process.env)`), their callers `packages/session/src/start-notice.ts:20`, `packages/session/src/turn-extension.ts:44`, `packages/orchestration/src/decision-log.ts:170,190`, `packages/orchestration/src/decision-hooks.ts:27,53`, `packages/orchestration/src/inbox-extension.ts:116`
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: `redact` takes the values to replace as an argument, and the host hands every plugin, with `host.env`, the set of all loaded values (`host.secrets`, values only, no names; or the core provides `redact` itself in `@arthur/core/credential`, both plugins importing it, which also ends the duplicate); the two `credential.ts` keep the shape rules. Tests: each caller's test with a value in the env file and none in `process.env`, asserting `[redacted]`.
- `npm test` and `npm run check` pass.

## Scope

In:
- `redact` takes the values to replace as an argument, and the host hands every plugin, with `host.env`, the set of all loaded values (`host.secrets`, values only, no names; or the core provides `redact` itself in `@arthur/core/credential`, both plugins importing it, which also ends the duplicate); the two `credential.ts` keep the shape rules. Tests: each caller's test with a value in the env file and none in `process.env`, asserting `[redacted]`.

## Decisions

- 2026-10-23: Source: F4 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
