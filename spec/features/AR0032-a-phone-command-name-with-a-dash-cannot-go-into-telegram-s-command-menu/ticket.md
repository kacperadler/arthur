# AR0032 - A phone command name with a dash cannot go into Telegram's command menu

```json
{
  "id": "AR0032",
  "title": "A phone command name with a dash cannot go into Telegram's command menu",
  "date": "2026-10-16",
  "after": [
    "AR0012"
  ]
}
```

## Description

the registry accepts command names of lowercase letters, digits and dashes (`review-needed`, `retro-due`), and any phone command's `about`. Telegram's `setMyCommands` takes only `[a-z0-9_]{1,32}` names and a description of 3 to 256 characters, so a phone command named with a dash, or with a short or long `about`, would make the menu call fail when entry 50 builds it.

## Goal

Every phone command can appear in Telegram's command menu: a name Telegram cannot list (a dash) is refused or mapped, so no command is reachable by text but missing from the menu.

- Kind: risk

Evidence:
- `packages/core/src/commands.ts` (`NAME`, `phone()`)
- Found by: 2026-10-16-ar0009-command-registry-daf148e5 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: in entry 50, decide whether the registry refuses such phone commands at registration (all channels then share Telegram's limits) or telegram maps or skips them in its menu; the CLI names stay as they are.
- `npm test` and `npm run check` pass.

## Scope

In:
- in entry 50, decide whether the registry refuses such phone commands at registration (all channels then share Telegram's limits) or telegram maps or skips them in its menu; the CLI names stay as they are.

## Decisions

- 2026-10-16: Source: F1 of AR0009
