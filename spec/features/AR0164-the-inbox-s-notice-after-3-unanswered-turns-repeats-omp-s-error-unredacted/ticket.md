# AR0164 - The inbox's notice after 3 unanswered turns repeats omp's error unredacted

```json
{
  "id": "AR0164",
  "title": "The inbox's notice after 3 unanswered turns repeats omp's error unredacted",
  "date": "2026-10-19"
}
```

## Description

after 3 coordinator turns in a row end without a reply, the inbox writes the notice `the coordinator's last 3 turns ended without a reply (<stopReason>: <errorMessage>); ...`, with the agent's `errorMessage` as omp gives it. A provider whose error echoes a key or token sends it to every channel. The session's `turn failed on <host>` notice (entry 38) redacts the same text (`packages/session/src/credential.ts`); this one does not.

## Goal

The inbox's notice after 3 unanswered turns removes credentials from omp's error the same way the turn-failed notice does.

- Kind: risk

Evidence:
- `packages/orchestration/src/inbox-extension.ts:118`
- Found by: 2026-10-18-ar0157-0be32dff (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: redact the error in orchestration the same way (a plugin cannot import session's file, so orchestration needs its own copy or the core publishes one), with a test of a key in the error. Leave the notice's wording as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- redact the error in orchestration the same way (a plugin cannot import session's file, so orchestration needs its own copy or the core publishes one), with a test of a key in the error. Leave the notice's wording as it is.

## Decisions

- 2026-10-19: Source: F1 of AR0157
- 2026-10-19: The owner (Telegram, 07:2x): 'nie czekaj tylko rób' on the night's findings and the /restart question; the coordinator recommended /restart ends arthur run while a restart is due, approved with the rest.
- 2026-10-19: Coordinator (owner delegated Arthur calls): orchestration 1146 -> 1163 (+17, its own copy of credential.ts, as Done means allows) accepted.
