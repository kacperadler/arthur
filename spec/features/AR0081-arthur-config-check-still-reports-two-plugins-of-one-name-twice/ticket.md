# AR0081 - `arthur config check` still reports two plugins of one name twice

```json
{
  "id": "AR0081",
  "title": "`arthur config check` still reports two plugins of one name twice",
  "date": "2026-10-16"
}
```

## Description

`[orchestration, telegram, telegram]` prints the host's `plugins[2]: a second plugin named telegram; the first is plugins[1]` and then `checkEnv`'s `ARTHUR_TELEGRAM_ is the prefix of both plugin telegram and plugin telegram`: one mistake, two lines. AR0073 skips only the entries `asPlugin` refuses, since both tests pin the second line and the ticket asks for no behaviour change.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `packages/core/src/env.ts:50-58`, `packages/core/test/config-check.test.ts:78-81`, `packages/core/test/env.test.ts:126-140`
- Found by: 2026-10-16-ar0073-core-dedup-and-co-0a7f996f (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: `checkEnv` also skips a second plugin of a name already seen (one line in its `plugins` filter), and the two tests drop the prefix line for that case; a prefix shared by two different plugins or instances stays refused.
- `npm test` and `npm run check` pass.

## Scope

In:
- `checkEnv` also skips a second plugin of a name already seen (one line in its `plugins` filter), and the two tests drop the prefix line for that case; a prefix shared by two different plugins or instances stays refused.

## Decisions

- 2026-10-16: Source: F1 of AR0073
