# AR0051 - A log cut by hand and grown past the kept number while the daemon is down replays from the wrong place

```json
{
  "id": "AR0051",
  "title": "A log cut by hand and grown past the kept number while the daemon is down replays from the wrong place",
  "date": "2026-10-16"
}
```

## Description

at its start, `arthur run` compares the kept number only with the log's last number. When the log is cut by hand (numbers start again at 1) and more events than the kept number are appended before the next start, it delivers the new log's events after the kept number and skips the ones before it, with no warning. [INFERENCE] from the lines; not run.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: security

Evidence:
- `packages/core/src/events.ts:112`
- Found by: 2026-10-16-ar0044-events-replay-aft-8791d5a8 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: keep the delivered event's time (or its first bytes) beside its number and check that the log still holds that event before replaying; when it does not, start from the log's end with the same warning as a cut log. Out: any change to the log's format.
- `npm test` and `npm run check` pass.

## Scope

In:
- keep the delivered event's time (or its first bytes) beside its number and check that the log still holds that event before replaying; when it does not, start from the log's end with the same warning as a cut log. Out: any change to the log's format.

## Decisions

- 2026-10-16: Source: F2 of AR0044
