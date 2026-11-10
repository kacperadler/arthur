# AR0684 - An audio file transcript still proves the owner answer; only his voice notes may (AR-D616)

```json
{
  "id": "AR0684",
  "title": "An audio file transcript still proves the owner answer; only his voice notes may (AR-D616)",
  "date": "2026-11-10"
}
```

## Description

A decision answer is recorded only from words in the owner's own channel message (AR0664, AR0668). Today the transcript of an audio file he sends counts as his words, though a forwarded recording holds someone else's voice. The owner decided (AR-D616) that only his voice notes count.

## Goal

AR0668 finding F5: `packages/orchestration/src/decision-proof.ts:16`, `own()` accepts `[voice …]` and `[audio …]` transcript lines alike. Owner, 2026-11-10: "AR-D616 - 1" (only voice notes count; an audio file transcript never proves an answer).

- Kind: security

## Done means

- A `[audio <n> s] <transcript> (/<path>)` line in his message is dropped from the words that can prove an answer, like a photo or file line; a `[voice …]` transcript still counts.
- In `packages/orchestration/test/decisions.test.ts`, the audio row that now proves an answer is turned into a refusal, and a test fails if `audio` is added back to `own()`; the voice rows, the decimal-length row included, still pass.
- `packages/orchestration/docs/commands/decision.md` says only a voice note's transcript counts.

## Scope

In:
- `packages/orchestration/src/decision-proof.ts`, `packages/orchestration/test/decisions.test.ts`, `packages/orchestration/docs/commands/decision.md`.

Out:
- How listen transcribes, or what a channel writes for an audio file.

## Decisions
