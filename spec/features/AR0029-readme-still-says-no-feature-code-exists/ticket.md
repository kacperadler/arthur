# AR0029 - README still says no feature code exists

```json
{
  "id": "AR0029",
  "title": "README still says no feature code exists",
  "date": "2026-10-16"
}
```

## Description

"No feature code exists" has been wrong since AR0005 merged `loadConfig`; AR0006 adds `arthur config check`.

## Goal

README.md says what exists today (config loading, env check) instead of claiming no feature code exists.

- Kind: refactor

Evidence:
- `README.md:5`
- Found by: 2026-10-16-ar0006-config-env-names-8aca9224 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: say what runs today (`arthur config check`) and that the rest is in the roadmap.
- `npm test` and `npm run check` pass.

## Scope

In:
- say what runs today (`arthur config check`) and that the rest is in the roadmap.

## Decisions

- 2026-10-16: Source: F2 of AR0006
