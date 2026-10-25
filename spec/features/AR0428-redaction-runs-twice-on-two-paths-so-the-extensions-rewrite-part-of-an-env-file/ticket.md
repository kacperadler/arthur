# AR0428 - Redaction runs twice on two paths, so the extensions rewrite part of an env-file secret before the plugin can match it whole

```json
{
  "id": "AR0428",
  "title": "Redaction runs twice on two paths, so the extensions rewrite part of an env-file secret before the plugin can match it whole",
  "date": "2026-10-25"
}
```

## Description

F2 of AR0340 (review 2026-10-25-review-3c2d06da, non-blocking note). Two paths redact twice: `packages/orchestration/src/inbox-extension.ts:116` then `inbox.ts:182`, and `packages/session/src/turn-extension.ts:44` then `start-notice.ts:96`. The extension redacts first with no values (`[]`), so its shape rules rewrite part of an env-file secret; the plugin's second pass with `host.secrets` then cannot match the whole value. `redact(redact("401 pass-word-sk-live-4f9a8b7c", []), [s])` gives `401 pass-word-[redacted]`; one pass gives `401 [redacted]`. A Telegram bot token keeps its `<bot id>:` part. Only the part before a vendor-style key or a long token leaks, never the whole value.

## Goal

A secret from the env file is redacted whole on every path to the phone; tested.

- Kind: security

## Done means

- The extensions leave the raw text and the plugin side does the one redaction (or the extension pass gets the values too); a test on each path with a value like `pass-word-sk-live-4f9a8b7c` from the env file gives `[redacted]` and no part of it. Each test fails on main.
- The raw copies the extensions write (`<home>/session/turn-failed/`, `outbox/sent/`) are in the home folder, 0700; say in the final message whether they keep the raw text, and why.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/orchestration/src/inbox-extension.ts`, `packages/orchestration/src/inbox.ts`, `packages/session/src/turn-extension.ts`, `packages/session/src/start-notice.ts`, and their tests.

Out:
- The blocked-job notice: AR0341.

## Decisions

- 2026-10-25: Source: F2 of AR0340
- 2026-10-25: AR0428 approved under the owner standing word to take the coordinator recommendation without asking; the owner: "AR-D28 complete with your recommendations, and use them till the task is completed, so next time do not ask me, just do it by yourself" (AR-D30)
