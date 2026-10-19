# AR0210 - The nvm package still names the old licence

```json
{
  "id": "AR0210",
  "title": "The nvm package still names the old licence",
  "date": "2026-10-19"
}
```

## Description

every package says `"license": "Apache-2.0"` since AR0203, but nvm, merged just before it, still says `"SEE LICENSE IN ../../LICENSE"` (`grep -rn '"license"' packages/*/package.json`).

## Goal

Every Arthur package says Apache-2.0, and the structure test refuses any other licence value, so a new package cannot drift.

- Kind: cleanup
- Model: haiku

Evidence:
- `packages/nvm/package.json:5`
- Found by: 2026-10-19-ar0208-telegram-29caf33c (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: set it to `"Apache-2.0"`, and have `test/structure.ts`'s manifest check refuse any other value, so the next new package cannot drift; nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- set it to `"Apache-2.0"`, and have `test/structure.ts`'s manifest check refuse any other value, so the next new package cannot drift; nothing else changes.

## Decisions

- 2026-10-19: Source: F1 of AR0208
- 2026-10-19: Approved under the owner's word of the same day: findings are built in batches or with the roadmap entry that touches the same files.
