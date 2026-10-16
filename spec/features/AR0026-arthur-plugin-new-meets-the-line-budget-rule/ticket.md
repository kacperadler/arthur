# AR0026 - `arthur plugin new` meets the line-budget rule

```json
{
  "id": "AR0026",
  "title": "`arthur plugin new` meets the line-budget rule",
  "date": "2026-10-16"
}
```

## Description

the structure test fails a package that has no entry in `BUDGETS` (`packages/<name>: has no line budget; add one to test/structure.test.ts`), so the budget of each plugin is decided in its own ticket. Entry 66's Done means says the structure test passes on a package `arthur plugin new` creates; as written it would not until someone adds the plugin's budget line.

## Goal

A plugin made by `arthur plugin new` (roadmap entry 66) passes the structure test at once, getting its own line budget, so a new plugin never starts red.

- Kind: risk

Evidence:
- `test/structure.test.ts` (`BUDGETS`), `spec/roadmap.md` entry 66
- Found by: 2026-10-16-ar0004-repository-rules-e926d472 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: entry 66 either adds the line to `BUDGETS` itself or its Done means says the new plugin's ticket adds it; the structure test keeps refusing a package without a budget.
- `npm test` and `npm run check` pass.

## Scope

In:
- entry 66 either adds the line to `BUDGETS` itself or its Done means says the new plugin's ticket adds it; the structure test keeps refusing a package without a budget.

## Decisions

- 2026-10-16: Source: F1 of AR0004
