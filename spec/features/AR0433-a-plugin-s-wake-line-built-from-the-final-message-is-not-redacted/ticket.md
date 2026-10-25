# AR0433 - A plugin's wake line built from the final message is not redacted

```json
{
  "id": "AR0433",
  "title": "A plugin's wake line built from the final message is not redacted",
  "date": "2026-10-25"
}
```

## Description

F2 of AR0341 (spec/features/AR0341-a-blocked-job-s-question-goes-to-the-phone-as-written-while-the-decision-log-redacts-it/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-da17ff9b (worker), 2026-10-25
- Where: `packages/orchestration/src/inbox.ts:138`, `packages/projects/src/onboarding.ts:31`
- What: the wake redacts the job's question and the lines of its final message it shows, but hands each `coordinator.wake` provider the final message as the job wrote it (the providers parse it), and pushes their lines unredacted. projects' onboarding answers the questions it reads from the onboarding job's final message, so a credential in one reaches the coordinator's transcript through that line. Redacting every plugin line in the wake would also redact the job ids in their `arthur continue <id>` lines (F1).
- Suggestion: each provider that quotes the final message redacts what it quotes with `host.secrets` and its own copy of the rules; or, after F1, the wake redacts the plugins' lines too.

## Goal

No line a plugin adds to the wake carries a value of the env file; tested.

- Kind: security

## Done means

- The wake passes each `coordinator.wake` provider's lines through `redactValues(…, host.secrets)`, as it does the final message's lines since AR0341, so job ids in `arthur continue <id>` stay readable. Test in `packages/orchestration/test/`: an onboarding job's final message holding an env-file value in a question gives a wake whose plugin line shows `[redacted]`; it fails on main.
- Also: a `Blocked: on <text>` first line goes through the same values-only redaction (AR0341's review 2 note).
- `npm test` and `npm run check` pass; orchestration's budget may be raised by the lines needed (AR-D29).

## Scope

In:
- `packages/orchestration/src/inbox.ts`, its test.

Out:
- The shape rules for plugin lines.

## Decisions

- 2026-10-25: Source: F2 of AR0341
- 2026-10-25: AR0433 approved under AR-D31, group 2; the owner: "always go with recommendation till the 8 am morning" (AR-D39)
