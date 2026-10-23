# AR0041 - Roadmap 35-36: a handoff before compaction, and a fresh start that retries

```json
{
  "id": "AR0041",
  "title": "Roadmap 35-36: a handoff before compaction, and a fresh start that retries",
  "date": "2026-10-16"
}
```

## Description

Changes the plan of roadmap entries 35 (compaction) and 36 (fresh start), in `spec/roadmap.md`, `spec/vision.md` where it describes the session, and `arthur.config.example.ts`. Docs only; the entries are built later.

## Goal

The coordinator never loses work across a compaction or a fresh start, and a busy evening no longer skips the nightly fresh start. From the owner's experience with the harness: a compaction must not drop an unanswered question to the human, and a fresh start skipped once leaves a session running into the next day.

- Kind: feat

## Done means

- Entry 35: before each compaction the coordinator writes a handoff, `.arthur/session/handoff.md`: work in progress, the next steps, and every question to the human still unanswered (with when it was asked); the compacted conversation starts by reading it. Running jobs still do not block compaction. Edge cases added: a handoff write that fails withdraws the compaction with one line; an empty handoff is not read back.
- Entry 36: at `freshAt` the fresh start waits until no job (worker, review, any kind) runs, retrying every `freshRetryMinutes` (default 15) until `freshUntil` (default "03:00"), then skips that night with one line; the new conversation starts from the same handoff. Edge cases added: a job that ends just before `freshUntil`; `freshUntil` earlier than `freshAt` across midnight; a job started during the wait (the wait goes on).
- `arthur.config.example.ts`: `freshRetryMinutes` and `freshUntil` with comments; checked as "HH:MM" and a positive whole number at load (named in entry 35/36 Done means).
- Vision lines on the session say the same.
- `npm test` and `npm run check` pass. English only.

## Scope

In:
- `spec/roadmap.md` entries 35 and 36, `spec/vision.md`, `arthur.config.example.ts`.

Out:
- Any code; other entries.

## Decisions

- 2026-10-16: The owner approved: a handoff with the pending list and unanswered questions before compaction; the fresh start retries every 15 minutes until 03:00 and starts only with no job and no review running.
