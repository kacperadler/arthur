# AR0268 - The coordinator's role names `arthur findings`, which a config without the findings plugin no longer has

```json
{
  "id": "AR0268",
  "title": "The coordinator's role names `arthur findings`, which a config without the findings plugin no longer has",
  "date": "2026-10-21",
  "after": [
    "AR0258"
  ]
}
```

## Description

`/findings` moved from orchestration, which every config holds, to the optional findings plugin. The role still says `arthur board`, `arthur task <id>` and `arthur findings <id>` show the board; without the plugin the last answers `arthur: unknown command findings`.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `packages/orchestration/roles/coordinator.md:21`
- Found by: AR0263 worker (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: either keep the line (Arthur's own config loads findings) and say so in a word, or let the findings plugin add its line to the coordinator's context through `coordinator.context`; nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- either keep the line (Arthur's own config loads findings) and say so in a word, or let the findings plugin add its line to the coordinator's context through `coordinator.context`; nothing else changes.

## Decisions

- 2026-10-21: Source: F2 of AR0263
- 2026-10-21: Approved by the owner (Telegram).
