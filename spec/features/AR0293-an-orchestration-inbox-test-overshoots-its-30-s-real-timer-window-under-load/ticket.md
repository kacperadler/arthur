# AR0293 - An orchestration inbox test overshoots its 30 s real-timer window under load

```json
{
  "id": "AR0293",
  "title": "An orchestration inbox test overshoots its 30 s real-timer window under load",
  "date": "2026-10-22"
}
```

## Description

The orchestration inbox tests that wait 30 s of real time fail when a full run is under load (48 s seen). They get a clock they control, so a merge is never refused by load.

## Goal

The 30 s waits in `packages/orchestration/test/inbox.test.ts` are driven by a controlled clock or an injected delay, so a full `npm test` under load passes them and they no longer cost half a minute each.

- Kind: security

## Done means

- The fix, with a test that proves it: the inbox tests assert the same 30 s behaviour without waiting 30 s of real time.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/orchestration/test/inbox.test.ts`, and the inbox's delay if it must be injectable.

## Decisions

- 2026-10-22: Source: F1 of AR0288
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
