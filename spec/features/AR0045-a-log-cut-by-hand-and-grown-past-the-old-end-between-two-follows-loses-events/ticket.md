# AR0045 - A log cut by hand and grown past the old end between two follows loses events

```json
{
  "id": "AR0045",
  "title": "A log cut by hand and grown past the old end between two follows loses events",
  "date": "2026-10-16"
}
```

## Description

the follower sees a cut log only when the file is smaller than the bytes it has read. When `events.jsonl` is emptied by hand and other processes append more than the old size within one follow (500 ms), the follower reads from the old byte offset in the middle of new lines, and the new numbers, which start again at 1, are below the next number it expects, so those events are not delivered. Hand edits of the log are the only way in.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `packages/core/src/events.ts:66`
- Found by: 2026-10-16-ar0035-command-events-re-21f43133 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: also start again from the end when the first line read from the old offset does not continue the numbers (its sequence number is below the next expected), or keep the file's inode and size and compare both.
- `npm test` and `npm run check` pass.

## Scope

In:
- also start again from the end when the first line read from the old offset does not continue the numbers (its sequence number is below the next expected), or keep the file's inode and size and compare both.

## Decisions

- 2026-10-16: Source: F2 of AR0035
