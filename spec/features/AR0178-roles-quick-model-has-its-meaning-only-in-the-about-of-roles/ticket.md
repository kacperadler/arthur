# AR0178 - `roles.quick.model` has its meaning only in the `about` of `roles`

```json
{
  "id": "AR0178",
  "title": "`roles.quick.model` has its meaning only in the `about` of `roles`",
  "date": "2026-10-19"
}
```

## Description

the table's `roles` entry gives each role's keys in `each` (`roles.*.model`, `roles.*.thinking`); `quick` takes only `model`, a single name, checked against a table of its own that `table` does not reach, so `everyOption` lists no `roles.quick.model` and the test over every table does not check its `about`.

## Goal

`roles.quick.model` gets its own line in the option table, so the owner finds its meaning where every other option's is.

- Kind: cleanup

Evidence:
- `packages/orchestration/src/orchestration-options.ts:34`
- Found by: 2026-10-19-ar0170-74fefb69 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: when entry 51 freezes the option table's type, decide whether an entry may name keys of its own beside `each` (here `quick`), and walk them; until then the meaning stays in the `about` of `roles`.
- `npm test` and `npm run check` pass.

## Scope

In:
- when entry 51 freezes the option table's type, decide whether an entry may name keys of its own beside `each` (here `quick`), and walk them; until then the meaning stays in the `about` of `roles`.

## Decisions

- 2026-10-19: Source: F2 of AR0170
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
- 2026-10-19: The owner: folded into roadmap entry 51's Done means and taken off the board; built with entry 51.
