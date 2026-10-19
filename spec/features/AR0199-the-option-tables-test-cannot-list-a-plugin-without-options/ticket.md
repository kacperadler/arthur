# AR0199 - The option-tables test cannot list a plugin without options

```json
{
  "id": "AR0199",
  "title": "The option-tables test cannot list a plugin without options",
  "date": "2026-10-19"
}
```

## Description

the test asserts every listed plugin has at least one option, and that its unknown-option refusal ends with its option names, so commit-rules (only `enabled`, an empty table) is left out of `PLUGINS`; its summary and table are checked by its own test only.

## Goal

The option-tables test covers a plugin that has no options, so such a plugin is not left out of it.

- Kind: cleanup

Evidence:
- `test/option-tables.test.ts:54` and `:114`
- Found by: 2026-10-19-ar0188-commit-rules-3a76b3d2 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: allow an empty table there (assert the summary and tools as for the others) and list commit-rules.
- `npm test` and `npm run check` pass.

## Scope

In:
- allow an empty table there (assert the summary and tools as for the others) and list commit-rules.

## Decisions

- 2026-10-19: Source: F2 of AR0188
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
